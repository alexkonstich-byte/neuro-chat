import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useMessages, useChats } from '../store.js';
import { getSocket } from '../socket.js';
import { Avatar, NameLine } from '../components/UserChip.jsx';
import { BackButton, IconButton, Sheet, Button, Tag, Field, Input, Card } from '../components/ui.jsx';
import GroupCall from '../components/GroupCall.jsx';

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
  const [actionMsg, setActionMsg] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [voice, setVoice] = useState(null);
  const [callState, setCallState] = useState(null);
  const [groupCall, setGroupCall] = useState(null); // { kind } or null
  const [activeGroupCall, setActiveGroupCall] = useState(null); // someone else is in a call
  const [membersOpen, setMembersOpen] = useState(false);
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

  const recordVoice = async (videoCircle = false) => {
    if (voice?.recording) { voice.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true, video: videoCircle ? { facingMode: 'user', width: 320, height: 320 } : false,
      });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (ev) => chunks.push(ev.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type });
        const r = await api.uploadFile(file, videoCircle ? 'video_note' : 'voice');
        setPendingFiles([{ ...r, name: file.name, size: file.size }]);
        setVoice({ blobReady: true, kind: videoCircle ? 'video_note' : 'voice' });
      };
      mr.start();
      setVoice({
        recording: true, mediaRecorder: mr, kind: videoCircle ? 'video_note' : 'voice',
        stop: () => mr.stop(),
      });
    } catch (e) {
      flashToast('Нет доступа к микрофону/камере', 'bad');
    }
  };

  const reactTo = (msgId, emoji) => {
    getSocket().emit('message:react', { id: msgId, emoji });
    setActionMsg(null);
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

  return (
    <div className="h-full flex flex-col bg-ink-950">
      {/* HEADER */}
      <div className="safe-top sticky top-0 z-20 surface-strong border-b border-white/5 px-2 py-2 flex items-center gap-2">
        <div className="lg:hidden"><BackButton to="/" /></div>
        <button
          onClick={() => isGroup ? setMembersOpen(true) : null}
          className={`flex items-center gap-3 flex-1 min-w-0 ${isGroup ? 'press' : ''}`}
        >
          {headerAvatar}
          <div className="min-w-0 text-left">
            <div className="font-display text-base truncate">
              {peer && !isSelf && !isService ? <NameLine user={peer} /> : headerTitle}
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
          return (
            <div key={bi} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && !isSelf && <Avatar user={sender} size={32} />}
              <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {block.messages.map((m, i) => (
                  <MessageBubble
                    key={m.id} m={m} mine={isMe} sender={sender}
                    showSender={!isMe && i === 0 && (isGroup) && !!sender}
                    onLongPress={() => setActionMsg(m)}
                    onReply={() => setReplyTo(m)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* REPLY / ATTACHMENTS BAR */}
      {(replyTo || pendingFiles.length > 0 || voice?.recording) && (
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
          {voice?.recording && (
            <div className="text-bad font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-bad animate-pulse-soft" />
              Запись {voice.kind === 'video_note' ? 'кружка' : 'голосового'}…
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

          {!text && pendingFiles.length === 0 && !voice?.blobReady ? (
            <>
              <IconButton type="button" onClick={() => recordVoice(false)} title="Голосовое">🎙</IconButton>
              <IconButton type="button" onClick={() => recordVoice(true)} title="Кружок">⭕</IconButton>
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

      {/* Action sheet */}
      <Sheet open={!!actionMsg} onClose={() => setActionMsg(null)} title="Сообщение">
        <div className="p-1">
          <div className="surface rounded-2xl p-2 mb-2 flex justify-around text-2xl">
            {QUICK_REACTIONS.map((e) => (
              <button key={e} onClick={() => reactTo(actionMsg.id, e)} className="press px-1 py-1 hover:scale-110">{e}</button>
            ))}
          </div>
          <Card className="!p-0 divide-y divide-white/10">
            <button onClick={() => { setReplyTo(actionMsg); setActionMsg(null); }} className="press w-full text-left px-4 py-3.5">↩︎ Ответить</button>
            {actionMsg?.text && (
              <button onClick={() => { navigator.clipboard.writeText(actionMsg.text); setActionMsg(null); flashToast('Скопировано', 'ok'); }} className="press w-full text-left px-4 py-3.5">📋 Копировать</button>
            )}
            {actionMsg?.senderId === me?.id && (
              <button onClick={() => {
                getSocket().emit('message:delete', { id: actionMsg.id });
                setActionMsg(null);
              }} className="press w-full text-left px-4 py-3.5 text-bad">🗑 Удалить</button>
            )}
          </Card>
        </div>
      </Sheet>

      {/* Members sheet */}
      <MembersSheet open={membersOpen} onClose={() => setMembersOpen(false)} chat={chatMeta} me={me}
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

function MessageBubble({ m, mine, sender, showSender, onLongPress, onReply }) {
  const [pressId, setPressId] = useState(null);
  const start = () => {
    const t = setTimeout(() => onLongPress(), 380);
    setPressId(t);
  };
  const stop = () => { if (pressId) { clearTimeout(pressId); setPressId(null); } };
  const reactions = m.reactions ? Object.entries(m.reactions) : [];

  const senderColorIdx = (sender?.id || 0) % SENDER_COLORS.length;

  return (
    <div onTouchStart={start} onTouchEnd={stop} onMouseDown={start} onMouseUp={stop} onMouseLeave={stop}
      onDoubleClick={onReply}
      className={`bubble-in my-0.5 px-3 py-2 max-w-full ${mine
        ? 'bg-hero-gradient text-white rounded-2xl rounded-br-md shadow-glow-brand/40'
        : 'bg-ink-700 text-white rounded-2xl rounded-bl-md'}`}>
      {showSender && sender && (
        <div className={`text-xs font-semibold mb-0.5 ${SENDER_COLORS[senderColorIdx]}`}>
          <NameLine user={sender} withEmoji={false} />
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
    return <video src={url} controls className="rounded-full mt-1.5 w-48 h-48 object-cover bg-black" />;
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
