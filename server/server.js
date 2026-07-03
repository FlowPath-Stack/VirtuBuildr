// CROAKFALL pond server — minimal authoritative-relay for the prototype.
//
// Tracks connected frogs, relays position state at a fixed tick, and
// broadcasts join/leave/croak events. Clients fall back to bot frogs
// when this server isn't running, so it is strictly optional.
//
//   cd server && npm install && npm start
//   then open game/index.html (or serve it) — it connects to ws://localhost:8080

const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const TICK_MS = 100; // 10 Hz state broadcast

const wss = new WebSocketServer({ port: PORT });
const players = new Map(); // ws -> {id, name, color, x, y, z, ry}
let nextId = 1;

function broadcast(msg, except) {
  const data = JSON.stringify(msg);
  for (const ws of players.keys()) {
    if (ws !== except && ws.readyState === ws.OPEN) ws.send(data);
  }
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join' && !players.has(ws)) {
      const player = {
        id: 'p' + nextId++,
        name: String(msg.name || 'Frog').slice(0, 24),
        color: Number.isInteger(msg.color) ? msg.color : 0x4caf50,
        hat: typeof msg.hat === 'string' ? msg.hat.slice(0, 16) : null,
        x: 0, y: 0, z: 0, ry: 0,
      };
      players.set(ws, player);
      ws.send(JSON.stringify({
        type: 'welcome',
        id: player.id,
        players: [...players.values()],
      }));
      broadcast({ type: 'join', ...player }, ws);
      console.log(`+ ${player.name} (${player.id}) — ${players.size} in the pond`);
      return;
    }

    const player = players.get(ws);
    if (!player) return;

    if (msg.type === 'state') {
      player.x = +msg.x || 0;
      player.y = +msg.y || 0;
      player.z = +msg.z || 0;
      player.ry = +msg.ry || 0;
      player.hat = typeof msg.hat === 'string' ? msg.hat.slice(0, 16) : null;
    } else if (msg.type === 'croak') {
      broadcast({ type: 'croak', id: player.id }, ws);
    }
  });

  ws.on('close', () => {
    const player = players.get(ws);
    if (!player) return;
    players.delete(ws);
    broadcast({ type: 'leave', id: player.id });
    console.log(`- ${player.name} (${player.id}) — ${players.size} in the pond`);
  });
});

setInterval(() => {
  if (players.size < 2) return;
  broadcast({
    type: 'state',
    players: [...players.values()].map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z, ry: p.ry, hat: p.hat })),
  });
}, TICK_MS);

console.log(`CROAKFALL pond server listening on ws://localhost:${PORT}`);
