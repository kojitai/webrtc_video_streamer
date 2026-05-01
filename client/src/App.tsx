import { useEffect, useRef, useState } from 'react';

type Role = 'sender' | 'receiver';
type FacingMode = 'user' | 'environment';

type SignalMessage = {
  type: string;
  roomId?: string;
  role?: Role;
  payload?: any;
};

export function App() {
  const [roomId, setRoomId] = useState('demo-room');
  const [role, setRole] = useState<Role>('sender');
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const [joined, setJoined] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const log = (msg: string) => setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);

  const send = (message: SignalMessage) => {
    wsRef.current?.send(JSON.stringify(message));
  };

  const cleanup = () => {
    pcRef.current?.close();
    pcRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  const ensurePeer = async () => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({ type: 'ice-candidate', roomId, payload: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    if (role === 'sender') {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pcRef.current = pc;
    return pc;
  };

  const makeOffer = async () => {
    const pc = await ensurePeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: 'offer', roomId, payload: offer });
    log('Offer送信');
  };

  const joinRoom = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', roomId, role }));
      setJoined(true);
      log(`参加: room=${roomId}, role=${role}`);
    };

    ws.onmessage = async (event) => {
      const msg: SignalMessage = JSON.parse(event.data);
      if (msg.type === 'room-error') {
        log(`エラー: ${msg.payload?.message}`);
        return;
      }
      if (msg.type === 'peer-ready' && role === 'sender') {
        await makeOffer();
      }
      if (msg.type === 'offer' && role === 'receiver') {
        const pc = await ensurePeer();
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: 'answer', roomId, payload: answer });
        log('Offer受信 -> Answer送信');
      }
      if (msg.type === 'answer' && role === 'sender') {
        const pc = await ensurePeer();
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        log('Answer受信');
      }
      if (msg.type === 'ice-candidate') {
        const pc = await ensurePeer();
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
      }
      if (msg.type === 'peer-left') {
        log('相手が退出しました');
        cleanup();
      }
    };

    ws.onclose = () => {
      log('シグナリング切断');
      cleanup();
      setJoined(false);
    };
  };

  const leaveRoom = () => {
    wsRef.current?.close();
    wsRef.current = null;
  };

  useEffect(() => () => leaveRoom(), []);

  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1>WebRTC One-way Stream</h1>
      <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="room id" />
      <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
        <option value="sender">sender</option>
        <option value="receiver">receiver</option>
      </select>
      {role === 'sender' && (
        <select value={facingMode} onChange={(e) => setFacingMode(e.target.value as FacingMode)}>
          <option value="user">インカメ</option>
          <option value="environment">アウトカメ</option>
        </select>
      )}
      {!joined ? <button onClick={joinRoom}>参加</button> : <button onClick={leaveRoom}>退出</button>}

      <h2>送信映像</h2>
      <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: 360 }} />
      <h2>受信映像</h2>
      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', maxWidth: 360 }} />
      <pre>{logs.join('\n')}</pre>
    </main>
  );
}
