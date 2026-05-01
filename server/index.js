import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map();

const getRoom = (roomId) => {
  if (!rooms.has(roomId)) rooms.set(roomId, { sender: null, receiver: null });
  return rooms.get(roomId);
};

wss.on('connection', (ws) => {
  let joinedRoomId = null;
  let joinedRole = null;

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === 'join') {
      const { roomId, role } = msg;
      const room = getRoom(roomId);
      if ((role === 'sender' && room.sender) || (role === 'receiver' && room.receiver)) {
        ws.send(JSON.stringify({ type: 'room-error', payload: { message: `${role} は既に参加済み` } }));
        return;
      }
      room[role] = ws;
      joinedRoomId = roomId;
      joinedRole = role;
      ws.send(JSON.stringify({ type: 'joined', roomId, role }));

      const peer = role === 'sender' ? room.receiver : room.sender;
      if (peer) {
        peer.send(JSON.stringify({ type: 'peer-ready', roomId }));
        ws.send(JSON.stringify({ type: 'peer-ready', roomId }));
      }
      return;
    }

    if (!joinedRoomId) return;
    const room = getRoom(joinedRoomId);
    const peer = joinedRole === 'sender' ? room.receiver : room.sender;
    if (!peer) return;

    if (['offer', 'answer', 'ice-candidate'].includes(msg.type)) {
      peer.send(JSON.stringify({ ...msg, roomId: joinedRoomId }));
    }
  });

  ws.on('close', () => {
    if (!joinedRoomId || !joinedRole) return;
    const room = getRoom(joinedRoomId);
    const peer = joinedRole === 'sender' ? room.receiver : room.sender;
    room[joinedRole] = null;
    if (peer) peer.send(JSON.stringify({ type: 'peer-left', roomId: joinedRoomId }));
    if (!room.sender && !room.receiver) rooms.delete(joinedRoomId);
  });
});

app.use(express.static(path.resolve(__dirname, '../client/dist')));
app.get('*', (_, res) => {
  res.sendFile(path.resolve(__dirname, '../client/dist/index.html'));
});

const port = process.env.PORT || 5173;
server.listen(port, () => {
  console.log(`server listening on :${port}`);
});
