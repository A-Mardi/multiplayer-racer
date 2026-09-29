import WebSocket from '../web/node_modules/ws/wrapper.mjs';
import { cpus, platform, release } from 'node:os';
import assert from 'node:assert/strict';
const room = 'bench-' + Date.now(),
  base = process.argv[2] || 'ws://127.0.0.1:8093/ws';
const clients = [],
  latencies = [];
let measured = false;
try {
  for (let i = 0; i < 8; i++) {
    const ws = new WebSocket(
      base + '?' + new URLSearchParams({ room, name: 'Benchmark ' + (i + 1) }),
    );
    const client = { ws, id: '', seq: 0, state: null, snapshots: 0, maxLap: 0 };
    clients.push(client);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Connection timeout')), 10000);
      ws.once('error', reject);
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'welcome') {
          clearTimeout(timeout);
          client.id = msg.id;
          resolve();
        }
        if (msg.type === 'snapshot') {
          client.state = msg.players.find((p) => p.id === client.id);
          if (measured) client.snapshots++;
          if (client.state) {
            client.maxLap = Math.max(client.maxLap, client.state.lap);
            assert.ok(Number.isFinite(client.state.x));
          }
        }
        if (msg.type === 'pong' && measured) latencies.push(performance.now() - msg.time);
      });
    });
  }
  measured = true;
  const started = performance.now();
  const input = setInterval(() => {
    for (const c of clients) {
      const p = c.state;
      if (!p) continue;
      const phase = Math.atan2((p.y - 440) / 250, (p.x - 700) / 450) - 0.18,
        targetX = 700 + 450 * Math.cos(phase),
        targetY = 440 + 250 * Math.sin(phase);
      const desired = Math.atan2(targetY - p.y, targetX - p.x),
        error = Math.atan2(Math.sin(desired - p.angle), Math.cos(desired - p.angle));
      c.ws.send(
        JSON.stringify({
          type: 'input',
          seq: ++c.seq,
          up: p.speed < 155,
          left: error < -0.045,
          right: error > 0.045,
          down: false,
        }),
      );
    }
  }, 1000 / 30);
  const ping = setInterval(() => {
    for (const c of clients) c.ws.send(JSON.stringify({ type: 'ping', time: performance.now() }));
  }, 1000);
  await new Promise((resolve) => setTimeout(resolve, 24000));
  clearInterval(input);
  clearInterval(ping);
  const seconds = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  assert.ok(
    clients.every((c) => c.snapshots / seconds > 25),
    'snapshot delivery stayed above 25 Hz',
  );
  assert.ok(
    clients.some((c) => c.maxLap >= 1),
    'server validated a full lap',
  );
  console.log(
    JSON.stringify(
      {
        date: new Date().toISOString(),
        cpu: cpus()[0].model,
        os: platform() + ' ' + release(),
        node: process.version,
        clients: 8,
        durationSeconds: +seconds.toFixed(2),
        snapshotHz: clients.map((c) => +(c.snapshots / seconds).toFixed(2)),
        completedLaps: clients.map((c) => c.maxLap),
        pingSamples: latencies.length,
        rttP50Ms: +latencies[Math.floor(latencies.length * 0.5)].toFixed(2),
        rttP95Ms: +latencies[Math.floor(latencies.length * 0.95)].toFixed(2),
      },
      null,
      2,
    ),
  );
} finally {
  for (const c of clients) c.ws.close();
}
