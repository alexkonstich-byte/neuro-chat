import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useMessages, useChats } from '../store.js';
import { getSocket } from '../socket.js';
import { Avatar, NameLine } from '../components/UserChip.jsx';
import { BackButton, IconButton, Sheet, Button, Tag, Field, Input, Card } from '../components/ui.jsx';
import GroupCall from '../components/GroupCall.jsx';
import { useContextMenu } from '../components/ContextMenu.jsx';
import { toast } from '../store.js';

const QUICK_REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢', '🎉'];

export default function Chat() {
  const { id } = useParams();
  const chatId = Number(id);
  const me = useAuth((s) => s.user);
  const messages = useMessages((s) => s.byChat[chatId] || []);
  const setHistory = useMessages((s) => s.setHistory);
  const prepend = useMessages((s) => s.prepend);
  const setTyping = useChats((s) => s.setTyping);
  const typing = useChats((s) => s.typing[chatId] || {});
  const online = useChats((s) => s.online);
  const [chatMeta, setChatMeta] = useState(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [voice, setVoice] = useState(null);
  const [callState, setCallState] = useState(null);
  const [groupCall, setGroupCall] = useState(null); // { kind } or null
  const [activeGroupCall, setActiveGroupCall] = useState(null); // someone else is in a call
  const [membersOpen, setMembersOpen] = useState(false);
  const [muteOpen, setMuteOpen] = useState(false);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const msgCtx  = useContextMenu();
  const userCtx = useContextMenu();
  const fileInput = useRef(null);
  const galleryInput = useRef(null);
  const scrollRef = useRef(null);
  const lastScrollTopRef = useRef(0);

  const isSelf = chatMeta?.chat?.type === 'self';
  const isService = chatMeta?.chat?.type === 'service';
  const isGroup = chatMeta?.chat?.type === 'group';
  const peer = chatMeta?.peer;
  const members = chatMeta?.members || [];

  useEffect(() => {
    let cancel = false;
    const reload = () => {
      api.chat(chatId).then((r) => { if (!cancel) setChatMeta(r); });
      api.history(chatId).then((r) => { if (!cancel) setHistory(chatId, r.messages); });
    };
    reload();
    api.read(chatId).catch(() => {});
    getSocket().emit('chat:join', { chatId });
    return () => { cancel = true; };
  }, [chatId, setHistory]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (lastScrollTopRef.current === 0 || el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const loadOlder = async () => {
    if (messages.length === 0) return;
    const before = messages[0].id;
    const r = await api.history(chatId, before);
    prepend(chatId, r.messages);
  };

  const send = (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && pendingFiles.length === 0 && !voice?.blobReady) return;
    const attachmentIds = pendingFiles.map((f) => f.id);
    const kind =
      voice?.blobReady ? voice.kind :
      pendingFiles.length === 1 ? pendingFiles[0].kind :
      'text';
    getSocket().emit('message:send', {
      chatId, text: trimmed, replyTo: replyTo?.id || null, kind, attachmentIds,
    }, (ack) => {
      if (ack?.error) flashToast('Ошибка: ' + ack.error, 'bad');
      if (ack?.xpGained) flashXp(ack.xpGained);
    });
    setText(''); setReplyTo(null); setPendingFiles([]); setVoice(null);
    getSocket().emit('typing', { chatId, typing: false });
  };

  const onType = (v) => {
    setText(v);
    getSocket().emit('typing', { chatId, typing: v.length > 0 });
  };

  const onPickFile = async (e, kind) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const file of files) {
      const r = await api.uploadFile(file, kind || guessKind(file));
      setPendingFiles((p) => [...p, { ...r, name: file.name, size: file.size }]);
    }
  };

  // Push-to-hold recording. Returns a promise that resolves when recording stops.
  const startHoldRecord = async (videoCircle = false) => {
    // Don't double-start
    if (voice?.recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true, video: videoCircle ? { facingMode: 'user', width: 480, height: 480 } : false,
      });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      let cancelled = false;
      const startedAt = Date.now();

      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (cancelled) { setVoice(null); return; }
        const ms = Date.now() - startedAt;
        if (ms < 350) { setVoice(null); flashToast('Слишком коротко — удерживай кнопку', 'bad'); return; }

        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        const ext  = videoCircle ? 'webm' : 'webm';
        const file = new File([blob], `${videoCircle ? 'circle' : 'voice'}_${Date.now()}.${ext}`, { type: blob.type });
        const kind = videoCircle ? 'video_note' : 'voice';
        const r = await api.uploadFile(file, kind);

        // Auto-send right after upload — the bubble appears as if released = sent.
        getSocket().emit('message:send', {
          chatId, text: '', replyTo: replyTo?.id || null, kind, attachmentIds: [r.id],
          mediaMeta: { duration: ms },
        }, (ack) => {
          if (ack?.error) flashToast('Ошибка: ' + ack.error, 'bad');
        });
        setReplyTo(null);
        setVoice(null);
      };

      mr.start();
      setVoice({
        recording: true,
        kind: videoCircle ? 'video_note' : 'voice',
        startedAt,
        stream,                                  // expose the live stream so the overlay can preview it
        stop:   () => { try { mr.stop(); } catch {} },
        cancel: () => { cancelled = true; try { mr.stop(); } catch {} },
      });
    } catch (e) {
      flashToast('Нет доступа к микрофону/камере', 'bad');
    }
  };

  const stopHoldRecord = (cancel = false) => {
    if (!voice?.recording) return;
    if (cancel) voice.cancel?.();
    else voice.stop?.();
  };

  const reactTo = (msgId, emoji) => {
    getSocket().emit('message:react', { id: msgId, emoji });
  };

  const isPeerTyping = useMemo(() => {
    if (!peer && !isGroup) return false;
    const otherIds = Object.keys(typing).map(Number).filter((id) => id !== me?.id);
    return otherIds.length > 0;
  }, [typing, peer, me, isGroup]);

  const grouped = useMemo(() => groupBlocks(messages), [messages]);
  const memberById = useMemo(() => {
    const m = {};
    for (const u of members) m[u.id] = u;
    if (me) m[me.id] = me;
    return m;
  }, [members, me]);

  // Calls
  useEffect(() => {
    const onIncoming = (ev) => {
      const { chatId: cid, fromUser, kind, sdp } = ev.detail;
      if (cid !== chatId) return;
      if (confirm(`Входящий ${kind === 'video' ? 'видео' : 'аудио'} вызов от ${fromUser.displayName}. Принять?`)) {
        setCallState({ status: 'accepting', kind, peer: fromUser, remoteSdp: sdp });
      } else {
        getSocket().emit('call:reject', { toUserId: fromUser.id });
      }
    };
    window.addEventListener('neuro-call:incoming', onIncoming);

    const sock = getSocket();
    const onActive = (p) => {
      if (p.chatId !== chatId) return;
      setActiveGroupCall(p);
    };
    sock.on('group-call:active', onActive);

    return () => {
      window.removeEventListener('neuro-call:incoming', onIncoming);
      sock.off('group-call:active', onActive);
    };
  }, [chatId]);

  // ----- Header avatar/title -----
  const headerAvatar = isSelf
    ? <div className="w-10 h-10 rounded-full bg-hero-gradient grid place-items-center text-xl shadow-glow-brand">🔖</div>
    : isService
      ? <div className="w-10 h-10 rounded-full bg-premium-gradient grid place-items-center font-display text-base font-black shadow-glow-premium">N</div>
      : isGroup
        ? <div className="w-10 h-10 rounded-full bg-ink-700 grid place-items-center text-lg">👥</div>
        : <Avatar user={peer || { displayName: chatMeta?.chat?.title }} size={40} />;

  const headerTitle = isSelf ? 'Избранное'
    : isService ? 'Neuro'
    : isGroup ? (chatMeta?.chat?.title || 'Группа')
    : peer?.displayName || chatMeta?.chat?.title || '';

  const headerSubtitle = isSelf ? 'Личные заметки'
    : isService ? 'Системные уведомления'
    : isGroup ? `${members.length} участник${members.length === 1 ? '' : members.length < 5 ? 'а' : 'ов'}${isPeerTyping ? ' · печатает…' : ''}`
    : isPeerTyping ? 'печатает…'
    : (peer && online[peer.id] ? 'в сети' : 'не в сети');

  const isMuted = chatMeta && (chatMeta.mutedUntil > Date.now());
  const myNickname = chatMeta?.myNickname || null;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      {/* HEADER */}
      <div className="safe-top sticky top-0 z-20 surface-strong border-b border-white/5 px-2 py-2 flex items-center gap-2">
        <div className="lg:hidden"><BackButton to="/" /></div>
        <button
          {...(peer && !isService && !isSelf ? userCtx.handlers(() => buildUserMenu({
            user: peer, me,
            onOpenProfile: () => location.assign(`/profile/${peer.username}`),
            onMute: () => setMuteOpen(true),
            onNickname: () => setNicknameOpen(true),
          })) : {})}
          onClick={() => {
            if (isGroup) setMembersOpen(true);
            else if (peer && !isService && !isSelf) location.assign(`/profile/${peer.username}`);
          }}
          className={`flex items-center gap-3 flex-1 min-w-0 ${(isGroup || (peer && !isService && !isSelf)) ? 'press' : ''}`}
        >
          {headerAvatar}
          <div className="min-w-0 text-left">
            <div className="font-display text-base truncate flex items-center gap-1.5">
              {peer && !isSelf && !isService ? <NameLine user={peer} /> : headerTitle}
              {isMuted && <span title="Чат заглушён" className="text-xs opacity-60">🔕</span>}
            </div>
            <div className="text-[11px] text-white/55 truncate">{headerSubtitle}</div>
          </div>
        </button>
        {peer && !isService && !isSelf && !isGroup && (
          <>
            <IconButton onClick={() => startCall(chatMeta, peer, 'audio', setCallState)} title="Аудиозвонок">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 3 L7 3 L9 8 L7 10 C8.5 13 10.5 15 13.5 16.5 L15.5 14.5 L20.5 16.5 L20.5 20.5 C9 20.5 -1 9.5 0.5 -1 L3 -1 Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(1 1)"/>
              </svg>
            </IconButton>
            <IconButton onClick={() => startCall(chatMeta, peer, 'video', setCallState)} title="Видеозвонок">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="6" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M14 9 L20 6 L20 16 L14 13 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
            </IconButton>
          </>
        )}
        {isGroup && (
          <>
            <IconButton onClick={() => setGroupCall({ kind: 'audio' })} title="Звонок"><span>📞</span></IconButton>
            <IconButton onClick={() => setGroupCall({ kind: 'video' })} title="Видео"><span>🎥</span></IconButton>
            <IconButton onClick={() => setMembersOpen(true)} title="Участники"><span>👥</span></IconButton>
          </>
        )}
      </div>

      {isGroup && activeGroupCall && !groupCall && (
        <div className="bg-hero-gradient text-white px-3 py-2 flex items-center gap-3 animate-slide-up">
          <span className="animate-pulse-soft">📞</span>
          <div className="text-sm flex-1">Идёт звонок</div>
          <button onClick={() => setGroupCall({ kind: activeGroupCall.kind })}
            className="press text-xs font-bold px-3 py-1.5 rounded-full bg-white text-ink-950">
            Присоединиться
          </button>
        </div>
      )}

      {/* MESSAGES */}
      <div ref={scrollRef} onScroll={(e) => {
        lastScrollTopRef.current = e.currentTarget.scrollTop;
        if (e.currentTarget.scrollTop < 80) loadOlder();
      }} className="flex-1 overflow-y-auto px-2 py-3 space-y-1.5">
        {isService && <NeuroIntroCard />}
        {grouped.map((block, bi) => {
          const isMe = block.senderId === me?.id;
          const isSystem = block.kind === 'system' || !block.senderId;
          if (isSystem) {
            return (
              <div key={bi} className="flex justify-center py-1.5">
                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 max-w-[80%] text-center">
                  {block.messages.map((m) => m.text).join(' · ')}
                </div>
              </div>
            );
          }
          const sender = memberById[block.senderId] || (peer && peer.id === block.senderId ? peer : null);
          const senderLink = sender && !sender.isBot && sender.id !== me?.id
            ? `/profile/${sender.username}` : null;
          return (
            <div key={bi} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && !isSelf && (
                senderLink
                  ? <Link to={senderLink}><Avatar user={sender} size={32} /></Link>
                  : <Avatar user={sender} size={32} />
              )}
              <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {block.messages.map((m, i) => (
                  <MessageBubble
                    key={m.id} m={m} mine={isMe} sender={sender}
                    showSender={!isMe && i === 0 && (isGroup) && !!sender}
                    senderLink={senderLink}
                    contextHandlers={msgCtx.handlers(() => buildMessageMenu({
                      m, mine: isMe, onReply: () => setReplyTo(m), onCopy: () => {
                        if (m.text) { navigator.clipboard.writeText(m.text); toast.ok('Скопировано'); }
                      },
                      onDelete: () => getSocket().emit('message:delete', { id: m.id }),
                      onReact: (emoji) => getSocket().emit('message:react', { id: m.id, emoji }),
                    }))}
                    onReact={reactTo}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* REPLY / ATTACHMENTS BAR */}
      {(replyTo || pendingFiles.length > 0) && (
        <div className="px-3 py-2 surface border-t border-white/5 text-sm">
          {replyTo && (
            <div className="flex items-start gap-2 mb-1">
              <div className="w-1 self-stretch bg-hero-gradient rounded" />
              <div className="flex-1 min-w-0 truncate text-white/80">↩︎ {replyTo.text || `[${replyTo.kind}]`}</div>
              <button onClick={() => setReplyTo(null)} className="text-white/55 hover:text-white">✕</button>
            </div>
          )}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((f) => (
                <div key={f.id} className="px-2 py-1 bg-ink-700 rounded-lg text-xs flex items-center gap-1">
                  📎 {f.name?.slice(0, 24) || f.kind}
                  <button onClick={() => setPendingFiles((p) => p.filter(x => x.id !== f.id))} className="text-white/55 hover:text-white">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COMPOSER */}
      {isService ? (
        <div className="safe-bottom px-3 py-3 surface border-t border-white/5 text-center text-xs text-white/55">
          Это системный чат — отвечать здесь нельзя.
        </div>
      ) : (
        <form onSubmit={send} className="safe-bottom px-2 py-2 border-t border-white/5 bg-ink-900 flex items-end gap-1">
          <IconButton type="button" onClick={() => fileInput.current.click()} title="Файл">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M14 9 L8 15 C6.5 16.5 4 16.5 2.5 15 C1 13.5 1 11 2.5 9.5 L11 1 C12 0 13.5 0 14.5 1 C15.5 2 15.5 3.5 14.5 4.5 L7 12 C6.5 12.5 5.5 12.5 5 12 C4.5 11.5 4.5 10.5 5 10 L11 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </IconButton>
          <input ref={fileInput} type="file" hidden onChange={(e) => onPickFile(e, null)} multiple />
          <IconButton type="button" onClick={() => galleryInput.current.click()} title="Фото / видео">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/>
              <circle cx="7" cy="8" r="1.5" fill="currentColor"/>
              <path d="M2 14 L7 9 L11 13 L14 10 L18 14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            </svg>
          </IconButton>
          <input ref={galleryInput} type="file" hidden accept="image/*,video/*" onChange={(e) => onPickFile(e, null)} multiple />

          <textarea
            rows={1} value={text} onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={isSelf ? 'Заметка…' : 'Сообщение'}
            className="flex-1 bg-ink-700 rounded-2xl px-4 py-2.5 outline-none resize-none max-h-32 placeholder:text-white/40 border border-white/[0.06] focus:border-brand-indigo/40"
          />

          {!text && pendingFiles.length === 0 ? (
            <>
              <HoldButton
                title="Голосовое — нажми и держи"
                onHoldStart={() => startHoldRecord(false)}
                onHoldEnd={(cancel) => stopHoldRecord(cancel)}
                active={voice?.recording && voice?.kind === 'voice'}
                emoji="🎙"
              />
              <HoldButton
                title="Кружок — нажми и держи"
                onHoldStart={() => startHoldRecord(true)}
                onHoldEnd={(cancel) => stopHoldRecord(cancel)}
                active={voice?.recording && voice?.kind === 'video_note'}
                emoji="🎥"
              />
            </>
          ) : (
            <button type="submit" className="press w-11 h-11 grid place-items-center rounded-full bg-hero-gradient text-white shadow-glow-brand">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 17 L18 10 L3 3 L5 10 L13 10 L5 10 Z" fill="currentColor"/>
              </svg>
            </button>
          )}
        </form>
      )}

      {/* Push-to-hold recording overlay */}
      {voice?.recording && <RecordingOverlay voice={voice} onCancel={() => stopHoldRecord(true)} onSend={() => stopHoldRecord(false)} />}

      {/* Custom right-click / long-press menus */}
      {msgCtx.element}
      {userCtx.element}

      {/* Members sheet */}
      <MembersSheet open={membersOpen} onClose={() => setMembersOpen(false)} chat={chatMeta} me={me}
                    onChanged={() => api.chat(chatId).then((r) => setChatMeta(r))} />

      <MuteSheet open={muteOpen} onClose={() => setMuteOpen(false)} chatId={chatId}
                 isMuted={isMuted} mutedUntil={chatMeta?.mutedUntil}
                 onChanged={() => api.chat(chatId).then((r) => setChatMeta(r))} />

      <NicknameSheet open={nicknameOpen} onClose={() => setNicknameOpen(false)} chatId={chatId}
                     current={myNickname}
                     onChanged={() => api.chat(chatId).then((r) => setChatMeta(r))} />

      {callState && <CallOverlay chat={chatMeta} state={callState} setState={setCallState} />}
      {groupCall && (
        <GroupCall
          chatId={chatId}
          kind={groupCall.kind}
          me={me}
          members={members}
          onClose={() => { setGroupCall(null); setActiveGroupCall(null); }}
        />
      )}
    </div>
  );
}

function MessageBubble({ m, mine, sender, showSender, senderLink, contextHandlers }) {
  const reactions = m.reactions ? Object.entries(m.reactions) : [];
  const senderColorIdx = (sender?.id || 0) % SENDER_COLORS.length;

  return (
    <div
      {...(contextHandlers || {})}
      className={`bubble-in my-0.5 px-3 py-2 max-w-full ${mine
        ? 'bg-hero-gradient text-white rounded-2xl rounded-br-md shadow-glow-brand/40'
        : 'bg-ink-700 text-white rounded-2xl rounded-bl-md'}`}>
      {showSender && sender && (
        <div className={`text-xs font-semibold mb-0.5 ${SENDER_COLORS[senderColorIdx]}`}>
          {senderLink
            ? <Link to={senderLink} className="hover:underline"><NameLine user={sender} withEmoji={false} /></Link>
            : <NameLine user={sender} withEmoji={false} />}
        </div>
      )}
      {m.replyTo && (
        <div className="text-xs opacity-80 border-l-2 border-white/40 pl-2 mb-1.5">↩︎ ответ</div>
      )}
      {m.deletedAt ? (
        <span className="italic opacity-70">Сообщение удалено</span>
      ) : (
        <>
          {m.text && <div className="whitespace-pre-wrap break-words leading-snug">{m.text}</div>}
          {m.attachments?.map((a) => <Attachment key={a.id} a={a} />)}
        </>
      )}
      {reactions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {reactions.map(([emoji, users]) => (
            <span key={emoji} className="text-xs bg-black/25 rounded-full px-2 py-0.5">{emoji} {users.length}</span>
          ))}
        </div>
      )}
      <div className="text-[10px] opacity-60 text-right mt-0.5 font-mono">
        {formatTime(m.createdAt)}{m.editedAt && ' · ред.'}
      </div>
    </div>
  );
}

const SENDER_COLORS = [
  'text-brand-sky', 'text-brand-fuchsia', 'text-premium-amber', 'text-ok',
  'text-pink-300', 'text-cyan-300', 'text-violet-300', 'text-rose-300',
];

function Attachment({ a }) {
  const url = `/uploads/${a.path}`;
  if (a.kind === 'photo' || (a.mime || '').startsWith('image/'))
    return <img src={url} className="rounded-xl mt-1.5 max-h-72" />;
  if (a.kind === 'video_note')
    return <video src={url} controls playsInline className="rounded-3xl mt-1.5 w-56 h-56 object-cover bg-black border border-white/10" />;
  if (a.kind === 'video' || (a.mime || '').startsWith('video/'))
    return <video src={url} controls className="rounded-xl mt-1.5 max-h-80" />;
  if (a.kind === 'voice' || (a.mime || '').startsWith('audio/'))
    return <audio src={url} controls className="mt-1.5 w-full" />;
  return <a href={url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-2 underline opacity-90">📄 {a.path.split('/').pop()}</a>;
}

function MembersSheet({ open, onClose, chat, me, onChanged }) {
  const [tab, setTab] = useState('list');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  useEffect(() => { if (!open) { setTab('list'); setQ(''); setResults([]); } }, [open]);
  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    let cancel = false;
    api.searchUsers(q).then((r) => { if (!cancel) setResults(r.users); });
    return () => { cancel = true; };
  }, [q]);

  if (!chat) return null;
  const myMember = chat.members?.find((m) => m.id === me?.id);
  const isOwner = chat.chat.created_by === me?.id;
  const presentIds = new Set((chat.members || []).map((m) => m.id));

  const add = async (u) => {
    await api.addMembers(chat.chat.id, [u.id]);
    onChanged?.();
  };
  const kick = async (u) => {
    if (!confirm(`Удалить ${u.displayName} из группы?`)) return;
    await api.removeMember(chat.chat.id, u.id);
    onChanged?.();
  };
  const leave = async () => {
    if (!confirm('Покинуть группу?')) return;
    await api.removeMember(chat.chat.id, me.id);
    location.href = '/';
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Участники · ${chat.members?.length ?? 0}`}>
      <div className="p-2">
        <div className="flex gap-1.5 mb-3 px-1">
          <button onClick={() => setTab('list')} className={`press flex-1 py-2 rounded-full text-sm font-semibold ${tab === 'list' ? 'bg-hero-gradient' : 'bg-ink-700'}`}>Все</button>
          <button onClick={() => setTab('add')}  className={`press flex-1 py-2 rounded-full text-sm font-semibold ${tab === 'add'  ? 'bg-hero-gradient' : 'bg-ink-700'}`}>＋ Добавить</button>
        </div>

        {tab === 'list' ? (
          <Card className="!p-1.5 max-h-80 overflow-y-auto">
            {(chat.members || []).map((u) => (
              <div key={u.id} className="rounded-xl px-2.5 py-2 flex items-center gap-3 hover:bg-white/5">
                <Avatar user={u} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate"><NameLine user={u} /></div>
                  <div className="text-xs text-white/55 font-mono truncate">@{u.username}</div>
                </div>
                {chat.chat.created_by === u.id && <Tag tone="brand">владелец</Tag>}
                {isOwner && u.id !== me.id && (
                  <button onClick={() => kick(u)} className="text-bad text-xs ml-1">удалить</button>
                )}
              </div>
            ))}
            {myMember && (
              <button onClick={leave} className="press w-full text-left rounded-xl px-2.5 py-2 mt-1 text-bad">
                ← Покинуть группу
              </button>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="@username" />
            {results.length > 0 && (
              <Card className="!p-1.5 max-h-80 overflow-y-auto">
                {results.map((u) => (
                  <div key={u.id} className="rounded-xl px-2.5 py-2 flex items-center gap-3 hover:bg-white/5">
                    <Avatar user={u} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate"><NameLine user={u} /></div>
                      <div className="text-xs text-white/55 font-mono truncate">@{u.username}</div>
                    </div>
                    {presentIds.has(u.id) ? (
                      <Tag>уже в группе</Tag>
                    ) : (
                      <Button size="sm" onClick={() => add(u)}>Добавить</Button>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function NeuroIntroCard() {
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(null); // 'bug' | 'feature' | 'message' | null
  const [text, setText] = React.useState('');
  const submit = async () => {
    if (text.trim().length < 3) return;
    setBusy(true);
    try {
      await api.sendFeedback(open, text.trim());
      toast.ok('Спасибо! Заявка отправлена', 'Я получу её в админке');
      setText(''); setOpen(null);
    } catch (e) {
      toast.bad('Не удалось отправить');
    } finally { setBusy(false); }
  };
  const titles = { bug: 'Сообщить о баге', feature: 'Предложить фичу', message: 'Написать админу' };
  const msgBubble = (content) => (
    <div className="flex gap-2 justify-start my-1.5">
      <div className="w-8 h-8 rounded-full bg-premium-gradient grid place-items-center font-display text-sm font-black shadow-glow-premium shrink-0">N</div>
      <div className="max-w-[80%] bg-ink-700 text-white rounded-2xl rounded-bl-md px-3 py-2 text-sm">
        {content}
      </div>
    </div>
  );
  return (
    <div className="px-1 py-2">
      {msgBubble(
        <div>
          <p className="font-semibold mb-1">Привет 👋 Это чат Neuro.</p>
          <p className="text-white/70 text-xs mb-2.5">Здесь приходят коды входа и системные оповещения. Если нашёл баг или хочешь что-то предложить — нажми ниже:</p>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => setOpen('bug')}     className="press bg-white/10 hover:bg-white/20 rounded-xl py-2 text-xs font-semibold transition">🐞 Баг</button>
            <button onClick={() => setOpen('feature')} className="press bg-white/10 hover:bg-white/20 rounded-xl py-2 text-xs font-semibold transition">💡 Идея</button>
            <button onClick={() => setOpen('message')} className="press bg-white/10 hover:bg-white/20 rounded-xl py-2 text-xs font-semibold transition">✉️ Админу</button>
          </div>
          {open && (
            <div className="mt-2.5 space-y-1.5 animate-slide-up">
              <div className="text-[10px] uppercase tracking-widest text-white/50 font-mono">{titles[open]}</div>
              <textarea
                value={text} onChange={(e) => setText(e.target.value)}
                rows={3} maxLength={4000}
                className="w-full bg-ink-800 rounded-xl border border-white/[0.06] px-3 py-2 outline-none focus:border-brand-indigo/60 text-xs"
                placeholder={open === 'bug' ? 'Опиши баг...' : open === 'feature' ? 'Какую фичу хочешь?' : 'Что хочешь сказать?'}
              />
              <div className="flex gap-1.5">
                <button disabled={busy || text.trim().length < 3} onClick={submit}
                  className="press flex-1 py-1.5 rounded-xl bg-hero-gradient text-xs font-semibold disabled:opacity-50">
                  {busy ? '...' : 'Отправить'}
                </button>
                <button onClick={() => { setOpen(null); setText(''); }} className="press py-1.5 px-3 rounded-xl bg-white/[0.06] text-xs">Отмена</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildMessageMenu({ m, mine, onReply, onCopy, onDelete, onReact }) {
  const reactRow = {
    label: '— реакции —',
    disabled: false,
    icon: '⌣',
    onSelect: () => {},
    // we render a special row via a custom item (see below) — for simplicity we add quick-react entries:
  };
  const items = [];
  for (const e of ['❤️','👍','😂','🔥','😮']) {
    items.push({ icon: e, label: `Реакция ${e}`, onSelect: () => onReact(e) });
  }
  items.push(null);
  items.push({ icon: '↩︎', label: 'Ответить', onSelect: onReply });
  if (m.text) items.push({ icon: '📋', label: 'Копировать текст', onSelect: onCopy });
  if (mine) {
    items.push(null);
    items.push({ icon: '🗑', label: 'Удалить', danger: true, onSelect: onDelete });
  }
  return items;
}

function buildUserMenu({ user, me, onOpenProfile, onMute, onNickname }) {
  const items = [
    { icon: '👤', label: 'Открыть профиль', onSelect: onOpenProfile },
    null,
    { icon: '🔕', label: 'Заглушить чат', onSelect: onMute },
    { icon: '✏️', label: 'Переименовать в чате', onSelect: onNickname },
  ];
  if (me?.isAdmin && !user?.isAdmin) {
    items.push(null);
    items.push({ icon: '🚫', label: 'Забанить (админка)', danger: true, onSelect: () => location.assign('/admin') });
  }
  return items;
}

function groupBlocks(msgs) {
  const out = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    const isSystem = m.kind === 'system' || !m.senderId;
    if (last && last.senderId === m.senderId && last.kind === m.kind && !isSystem &&
        (m.createdAt - last.messages[last.messages.length - 1].createdAt) < 3 * 60 * 1000) {
      last.messages.push(m);
    } else {
      out.push({ senderId: m.senderId, kind: isSystem ? 'system' : 'normal', messages: [m] });
    }
  }
  return out;
}

function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function guessKind(file) {
  const t = file.type || '';
  if (t.startsWith('image/')) return 'photo';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'voice';
  return 'file';
}

function flashXp(n) {
  const el = document.createElement('div');
  el.textContent = `+${n} XP`;
  el.className = 'fixed left-1/2 bottom-24 -translate-x-1/2 z-40 bg-ok text-ink-950 rounded-full px-4 py-1.5 text-sm font-bold shadow-2xl pointer-events-none';
  document.body.appendChild(el);
  setTimeout(() => { el.style.transition = 'all .8s cubic-bezier(.2,.9,.3,1)'; el.style.opacity = 0; el.style.transform = 'translate(-50%,-30px)'; }, 50);
  setTimeout(() => el.remove(), 1200);
}

function flashToast(text, tone = 'ok') {
  const el = document.createElement('div');
  el.textContent = text;
  const bg = tone === 'bad' ? 'bg-bad' : 'bg-ok';
  el.className = `fixed left-1/2 top-20 -translate-x-1/2 z-50 ${bg} text-white rounded-full px-4 py-1.5 text-sm font-semibold shadow-2xl`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.transition = 'all .8s'; el.style.opacity = 0; el.style.transform = 'translate(-50%,-30px)'; }, 1200);
  setTimeout(() => el.remove(), 2200);
}

// ---- Push-to-hold button: starts on press, stops on release. Drag-up = cancel ----
function HoldButton({ onHoldStart, onHoldEnd, active, emoji, title }) {
  const ref = React.useRef(null);
  const dragRef = React.useRef({ startY: 0, cancel: false });

  const start = (e) => {
    e.preventDefault();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startY: y, cancel: false };
    onHoldStart();
  };
  const move = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = dragRef.current.startY - y;
    if (dy > 80) dragRef.current.cancel = true;
  };
  const end = (e) => {
    e?.preventDefault?.();
    onHoldEnd(dragRef.current.cancel);
  };

  return (
    <button
      ref={ref}
      type="button"
      title={title}
      onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={(e) => { if (active) end(e); }}
      onTouchStart={start} onTouchMove={move} onTouchEnd={end} onTouchCancel={() => onHoldEnd(true)}
      onContextMenu={(e) => e.preventDefault()}
      className={`press w-11 h-11 grid place-items-center rounded-full text-xl select-none transition
        ${active ? 'bg-bad text-white scale-110 shadow-glow-brand' : 'hover:bg-white/10 text-white/85'}`}
    >
      <span className="pointer-events-none">{emoji}</span>
    </button>
  );
}

// ---- Recording overlay: shows mic/cam, level, duration, "release to send / drag up to cancel" ----
function RecordingOverlay({ voice, onCancel, onSend }) {
  const [elapsed, setElapsed] = React.useState(0);
  const videoRef = React.useRef(null);
  React.useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - voice.startedAt), 100);
    return () => clearInterval(t);
  }, [voice.startedAt]);
  React.useEffect(() => {
    if (videoRef.current && voice.stream && voice.kind === 'video_note') {
      videoRef.current.srcObject = voice.stream;
    }
  }, [voice.stream, voice.kind]);
  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor(elapsed / 1000) % 60).padStart(2, '0');
  const isCircle = voice.kind === 'video_note';

  return (
    <div className="fixed inset-0 z-50 bg-ink-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6">
      <div className="surface-strong rounded-4xl p-6 w-full max-w-sm text-center">
        <div className="font-display text-base text-white/70 mb-4">
          {isCircle ? 'Запись кружка' : 'Запись голосового'}
        </div>
        <div className="relative mx-auto w-56 h-56 mb-4">
          {/* Pulsing rings */}
          <div className="absolute inset-0 rounded-3xl bg-bad/25 animate-ping" />
          <div className="absolute inset-2 rounded-3xl bg-bad/30 animate-pulse-soft" />
          {isCircle ? (
            <video
              ref={videoRef} autoPlay playsInline muted
              // mirror the camera so it feels like a selfie
              style={{ transform: 'scaleX(-1)' }}
              className="relative w-full h-full rounded-3xl object-cover bg-ink-900 shadow-2xl border border-bad/40"
            />
          ) : (
            <div className="relative w-full h-full rounded-3xl bg-bad text-white grid place-items-center text-7xl shadow-2xl">
              🎙
            </div>
          )}
          {/* Recording indicator */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/55 px-2 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-bad animate-pulse-soft" />
            <span className="text-[10px] uppercase tracking-widest font-mono">REC</span>
          </div>
        </div>
        <div className="font-mono text-3xl text-white">{mm}:{ss}</div>
        <div className="text-xs text-white/55 mt-3">Отпусти кнопку, чтобы отправить · Свайп вверх — отмена</div>
        <div className="mt-5 flex justify-center gap-3">
          <button onClick={onCancel}
            className="press px-5 py-2.5 rounded-full bg-white/10 border border-white/15 font-semibold">
            Отмена
          </button>
          <button onClick={onSend}
            className="press px-5 py-2.5 rounded-full bg-hero-gradient font-semibold shadow-glow-brand">
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- WebRTC P2P (DM only for now) ----
async function startCall(chatMeta, peer, kind, setCallState) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
  for (const track of stream.getTracks()) pc.addTrack(track, stream);
  const sock = getSocket();
  pc.onicecandidate = (e) => { if (e.candidate) sock.emit('call:ice', { toUserId: peer.id, candidate: e.candidate }); };
  pc.ontrack = (e) => setCallState((s) => ({ ...(s || {}), remoteStream: e.streams[0] }));
  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: kind === 'video' });
  await pc.setLocalDescription(offer);
  sock.emit('call:invite', { chatId: chatMeta.chat.id, kind, sdp: offer });
  const onAccepted = async ({ fromUserId, sdp }) => { if (fromUserId !== peer.id) return; await pc.setRemoteDescription(sdp); };
  const onIce = async ({ fromUserId, candidate }) => { if (fromUserId !== peer.id) return; try { await pc.addIceCandidate(candidate); } catch {} };
  const onHangup = () => { pc.close(); stream.getTracks().forEach(t => t.stop()); setCallState(null); };
  sock.on('call:accepted', onAccepted);
  sock.on('call:ice', onIce);
  sock.on('call:hangup', onHangup);
  sock.on('call:rejected', onHangup);
  setCallState({ kind, peer, status: 'calling', pc, localStream: stream, hangup: () => { sock.emit('call:hangup', { toUserId: peer.id }); onHangup(); } });
}

function CallOverlay({ chat, state, setState }) {
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  useEffect(() => {
    if (localRef.current && state.localStream) localRef.current.srcObject = state.localStream;
    if (remoteRef.current && state.remoteStream) remoteRef.current.srcObject = state.remoteStream;
  }, [state]);
  return (
    <div className="fixed inset-0 z-40 bg-ink-950/95 flex flex-col items-center justify-center p-6 text-center">
      <div className="font-display text-2xl mb-2">{state.kind === 'video' ? 'Видеовызов' : 'Аудиовызов'}</div>
      <div className="text-white/70 mb-4">{state.peer.displayName}</div>
      <div className="relative w-full max-w-md aspect-square surface-strong rounded-3xl overflow-hidden mb-6">
        <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover" />
        <video ref={localRef} autoPlay playsInline muted className="absolute right-3 bottom-3 w-24 aspect-video rounded-2xl bg-black border border-white/10" />
      </div>
      <button onClick={() => state.hangup?.()} className="press px-8 py-4 rounded-full bg-bad font-display font-bold text-lg shadow-2xl">
        Завершить
      </button>
    </div>
  );
}

function MuteSheet({ open, onClose, chatId, isMuted, mutedUntil, onChanged }) {
  const [busy, setBusy] = React.useState(false);
  const options = [
    { label: '30 минут', minutes: 30 },
    { label: '1 час', minutes: 60 },
    { label: '8 часов', minutes: 480 },
    { label: '1 день', minutes: 1440 },
    { label: 'Навсегда', minutes: 60 * 24 * 365 * 10 },
  ];
  const mute = async (minutes) => {
    setBusy(true);
    try {
      await api.muteChat(chatId, minutes);
      await onChanged?.();
      onClose();
    } finally { setBusy(false); }
  };
  const unmute = async () => {
    setBusy(true);
    try {
      await api.muteChat(chatId, 0);
      await onChanged?.();
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Заглушить чат">
      <div className="p-3 space-y-2">
        {isMuted && (
          <button onClick={unmute} disabled={busy}
            className="press w-full py-3 rounded-2xl bg-ok/20 border border-ok/30 text-ok font-semibold text-sm">
            🔔 Включить уведомления
          </button>
        )}
        {options.map((o) => (
          <button key={o.minutes} onClick={() => mute(o.minutes)} disabled={busy}
            className="press w-full py-3 rounded-2xl surface border border-white/[0.06] text-sm font-semibold">
            🔕 {o.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function NicknameSheet({ open, onClose, chatId, current, onChanged }) {
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (open) setValue(current || ''); }, [open, current]);
  const save = async () => {
    setBusy(true);
    try {
      await api.setChatNickname(chatId, value.trim());
      await onChanged?.();
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Имя чата для тебя">
      <div className="p-3 space-y-3">
        <Field label="Псевдоним">
          <Input
            value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="Оставь пустым — вернётся оригинал"
            maxLength={60}
          />
        </Field>
        <Button onClick={save} disabled={busy} className="w-full h-12">
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </Sheet>
  );
}
