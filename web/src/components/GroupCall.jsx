import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '../socket.js';
import { Avatar, NameLine } from './UserChip.jsx';
import { Button } from './ui.jsx';

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function GroupCall({ chatId, kind = 'audio', me, members, onClose }) {
  const [peers, setPeers] = useState({}); // userId -> { user, stream, pc }
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(kind !== 'video');
  const localStreamRef = useRef(null);
  const peersRef = useRef({});

  // Helper to register peer state
  const upsertPeer = (uid, patch) => {
    peersRef.current[uid] = { ...(peersRef.current[uid] || {}), ...patch };
    setPeers((p) => ({ ...p, [uid]: { ...(p[uid] || {}), ...patch } }));
  };
  const dropPeer = (uid) => {
    const p = peersRef.current[uid];
    try { p?.pc?.close(); } catch {}
    delete peersRef.current[uid];
    setPeers((s) => { const c = { ...s }; delete c[uid]; return c; });
  };

  useEffect(() => {
    let mounted = true;
    const sock = getSocket();

    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true, video: kind === 'video',
      });
      localStreamRef.current = stream;
      if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
      sock.emit('group-call:join', { chatId, kind });
    })();

    function makePc(uid) {
      const pc = new RTCPeerConnection({ iceServers: ICE });
      pc.onicecandidate = (e) => {
        if (e.candidate) sock.emit('group-call:ice', { toUserId: uid, candidate: e.candidate, chatId });
      };
      pc.ontrack = (e) => upsertPeer(uid, { stream: e.streams[0] });
      pc.onconnectionstatechange = () => {
        if (['failed','closed','disconnected'].includes(pc.connectionState)) dropPeer(uid);
      };
      const ls = localStreamRef.current;
      if (ls) for (const t of ls.getTracks()) pc.addTrack(t, ls);
      upsertPeer(uid, { pc, user: members.find((m) => m.id === uid) || { id: uid, displayName: '#' + uid } });
      return pc;
    }

    // When somebody else joins, we (existing) create an offer to them.
    const onPeerJoined = async ({ peerUserId, peer }) => {
      if (peerUserId === me.id || peersRef.current[peerUserId]) return;
      const pc = makePc(peerUserId);
      upsertPeer(peerUserId, { user: peer });
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: kind === 'video' });
      await pc.setLocalDescription(offer);
      sock.emit('group-call:offer', { toUserId: peerUserId, sdp: offer, chatId });
    };
    const onOffer = async ({ fromUserId, sdp }) => {
      let pc = peersRef.current[fromUserId]?.pc || makePc(fromUserId);
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sock.emit('group-call:answer', { toUserId: fromUserId, sdp: answer, chatId });
    };
    const onAnswer = async ({ fromUserId, sdp }) => {
      const pc = peersRef.current[fromUserId]?.pc;
      if (pc) await pc.setRemoteDescription(sdp);
    };
    const onIce = async ({ fromUserId, candidate }) => {
      const pc = peersRef.current[fromUserId]?.pc;
      if (pc) try { await pc.addIceCandidate(candidate); } catch {}
    };
    const onLeft = ({ peerUserId }) => dropPeer(peerUserId);

    sock.on('group-call:peer-joined', onPeerJoined);
    sock.on('group-call:offer', onOffer);
    sock.on('group-call:answer', onAnswer);
    sock.on('group-call:ice', onIce);
    sock.on('group-call:peer-left', onLeft);

    return () => {
      mounted = false;
      sock.off('group-call:peer-joined', onPeerJoined);
      sock.off('group-call:offer', onOffer);
      sock.off('group-call:answer', onAnswer);
      sock.off('group-call:ice', onIce);
      sock.off('group-call:peer-left', onLeft);
      sock.emit('group-call:leave', { chatId });
      Object.keys(peersRef.current).forEach(dropPeer);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [chatId]);

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    tracks.forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  };
  const toggleCam = () => {
    const tracks = localStreamRef.current?.getVideoTracks() || [];
    tracks.forEach((t) => (t.enabled = camOff));
    setCamOff(!camOff);
  };

  const tiles = useMemo(() => {
    const arr = [{ id: me.id, user: me, isMe: true, stream: localStreamRef.current }];
    for (const [uid, p] of Object.entries(peers)) arr.push({ id: Number(uid), user: p.user, stream: p.stream });
    return arr;
  }, [peers, me]);

  return (
    <div className="fixed inset-0 z-50 bg-ink-950/95 flex flex-col">
      <div className="safe-top flex items-center px-4 py-3 border-b border-white/5">
        <div className="font-display text-lg">Групповой звонок</div>
        <div className="ml-auto text-xs text-white/55 font-mono">{tiles.length} участ.</div>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-2 p-2 content-start overflow-y-auto">
        {tiles.map((t) => <Tile key={t.id} t={t} kind={kind} />)}
      </div>
      <div className="safe-bottom px-4 py-3 flex items-center justify-center gap-3 border-t border-white/5 bg-ink-900">
        <button onClick={toggleMute} className={`press w-12 h-12 rounded-full ${muted ? 'bg-bad' : 'bg-ink-700'} grid place-items-center`}>
          {muted ? '🔇' : '🎙'}
        </button>
        {kind === 'video' && (
          <button onClick={toggleCam} className={`press w-12 h-12 rounded-full ${camOff ? 'bg-bad' : 'bg-ink-700'} grid place-items-center`}>
            {camOff ? '🚫' : '🎥'}
          </button>
        )}
        <button onClick={onClose} className="press px-7 h-12 rounded-full bg-bad font-display font-bold">Завершить</button>
      </div>
    </div>
  );
}

function Tile({ t, kind }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && t.stream) ref.current.srcObject = t.stream; }, [t.stream]);
  return (
    <div className="relative aspect-square rounded-2xl overflow-hidden bg-ink-800 border border-white/10">
      {kind === 'video' && t.stream ? (
        <video ref={ref} autoPlay playsInline muted={t.isMe} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full grid place-items-center bg-hero-soft">
          <Avatar user={t.user} size={96} />
        </div>
      )}
      <div className="absolute left-2 bottom-2 right-2 text-xs text-white/85 truncate">
        {t.user ? <NameLine user={t.user} /> : '...'}
        {t.isMe && <span className="text-white/45 ml-1">(вы)</span>}
      </div>
    </div>
  );
}
