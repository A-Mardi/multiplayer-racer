import { useEffect, useRef, useState } from 'react';
import { controls, step, onRoad, type Car, type Controls, type Driver } from './model';
const raw = new URLSearchParams(location.hash.slice(1)).get('room');
const room = raw && /^[\w-]{1,32}$/.test(raw) ? raw : 'lobby';
const spectating = new URLSearchParams(location.hash.slice(1)).get('watch') === '1';
const time = (seconds: number) => (seconds ? seconds.toFixed(2) + 's' : '—');
export default function App() {
  const [name, setName] = useState(
      () =>
        sessionStorage.getItem('circuit-name') || 'Driver ' + Math.floor(Math.random() * 900 + 100),
    ),
    [roomInput, setRoomInput] = useState(room),
    [joinMode, setJoinMode] = useState(spectating ? 'spectator' : 'driver'),
    [spectators, setSpectators] = useState(0),
    [status, setStatus] = useState('Connecting'),
    [drivers, setDrivers] = useState<Driver[]>([]),
    [metrics, setMetrics] = useState({
      speed: 0,
      fps: 0,
      correction: 0,
      lap: 0,
      best: 0,
      checkpoint: 0,
    }),
    [rtt, setRtt] = useState(0),
    [latency, setLatency] = useState(0),
    [notice, setNotice] = useState(
      spectating
        ? 'Watching live. Join as a driver from Room settings.'
        : 'Arrow keys or WASD to drive.',
    );
  const canvas = useRef<HTMLCanvasElement>(null),
    socket = useRef<WebSocket | null>(null),
    input = useRef(controls()),
    own = useRef(''),
    predicted = useRef<Car | null>(null),
    pending = useRef<(Controls & { seq: number })[]>([]),
    sequence = useRef(0),
    latest = useRef<Driver[]>([]),
    previous = useRef<Driver[]>([]),
    received = useRef(0),
    delay = useRef(latency),
    correction = useRef(0);
  delay.current = latency;
  useEffect(() => {
    let stopped = false,
      frame = 0,
      reconnect = 0,
      retry = 500,
      last = performance.now(),
      frames = 0,
      measure = last,
      lastUI = 0;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!stopped) fn();
      }, ms);
      timers.add(timer);
    };
    const send = (msg: object) => {
      const ws = socket.current;
      later(() => {
        if (ws === socket.current && ws?.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify(msg));
      }, delay.current / 2);
    };
    const connect = () => {
      if (stopped) return;
      setStatus('Connecting');
      const token = sessionStorage.getItem('circuit-token-' + room) || '';
      const ws = new WebSocket(
        (location.protocol === 'https:' ? 'wss:' : 'ws:') +
          '//' +
          location.host +
          '/ws?' +
          new URLSearchParams({
            room,
            name,
            token: spectating ? '' : token,
            spectate: spectating ? '1' : '0',
          }),
      );
      socket.current = ws;
      ws.onopen = () => {
        retry = 500;
        setStatus('Connected');
      };
      ws.onmessage = (event) =>
        later(() => {
          if (socket.current !== ws) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'welcome') {
              own.current = msg.role === 'spectator' ? '' : msg.id;
              if (msg.role !== 'spectator') {
                sequence.current = Math.max(sequence.current, msg.seq);
                sessionStorage.setItem('circuit-token-' + room, msg.token);
              }
              pending.current = [];
            }
            if (msg.type === 'pong') setRtt(Math.round(performance.now() - msg.time));
            if (msg.type === 'snapshot') {
              previous.current = latest.current;
              latest.current = msg.players;
              received.current = performance.now();
              const me = (msg.players as Driver[]).find((p) => p.id === own.current);
              if (me) {
                pending.current = pending.current.filter((p) => p.seq > me.seq);
                let next: Car = { x: me.x, y: me.y, angle: me.angle, speed: me.speed };
                for (const action of pending.current) next = step(next, action);
                if (predicted.current)
                  correction.current = Math.hypot(
                    next.x - predicted.current.x,
                    next.y - predicted.current.y,
                  );
                predicted.current = next;
              }
              if (performance.now() - lastUI > 200) {
                setDrivers(msg.players);
                setSpectators(msg.spectators || 0);
                lastUI = performance.now();
              }
            }
          } catch {
            setNotice('Could not read a server update.');
          }
        }, delay.current / 2);
      ws.onclose = (event) => {
        if (stopped) return;
        input.current = controls();
        predicted.current = null;
        pending.current = [];
        setStatus(event.code === 1008 ? event.reason : 'Reconnecting');
        if (event.code !== 1008) {
          reconnect = window.setTimeout(connect, retry);
          retry = Math.min(5000, retry * 2);
        }
      };
      ws.onerror = () => ws.close();
    };
    connect();
    const tick = setInterval(() => {
      if (socket.current?.readyState !== WebSocket.OPEN || !predicted.current) return;
      const action = { ...input.current, seq: ++sequence.current };
      predicted.current = step(predicted.current, action);
      pending.current.push(action);
      if (pending.current.length > 120) pending.current.shift();
      send({ type: 'input', ...action });
    }, 1000 / 30);
    const ping = setInterval(() => send({ type: 'ping', time: performance.now() }), 1000);
    const key = (e: KeyboardEvent) => {
      if (spectating) return;
      if ((e.target as HTMLElement).matches('input,select,textarea')) return;
      const mapping: Record<string, keyof Controls> = {
        ArrowUp: 'up',
        w: 'up',
        W: 'up',
        ArrowDown: 'down',
        s: 'down',
        S: 'down',
        ArrowLeft: 'left',
        a: 'left',
        A: 'left',
        ArrowRight: 'right',
        d: 'right',
        D: 'right',
      };
      const action = mapping[e.key];
      if (action) {
        e.preventDefault();
        input.current[action] = e.type === 'keydown';
      }
    };
    const blur = () => {
      input.current = controls();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    window.addEventListener('blur', blur);
    const draw = (now: number) => {
      const element = canvas.current,
        ctx = element?.getContext('2d');
      if (element && ctx) {
        const rect = element.getBoundingClientRect(),
          dpr = Math.min(devicePixelRatio || 1, 2),
          w = Math.round(rect.width * dpr),
          h = Math.round(rect.height * dpr);
        if (element.width !== w || element.height !== h) {
          element.width = w;
          element.height = h;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const scale = Math.min(w / 1400, h / 880);
        ctx.setTransform(scale, 0, 0, scale, (w - 1400 * scale) / 2, (h - 880 * scale) / 2);
        ctx.fillStyle = '#9fbaa833';
        ctx.beginPath();
        ctx.ellipse(700, 440, 550, 340, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f7f7f2';
        ctx.beginPath();
        ctx.ellipse(700, 440, 350, 160, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#263c3240';
        ctx.lineWidth = 1.5;
        for (const [rx, ry] of [
          [550, 340],
          [350, 160],
        ]) {
          ctx.beginPath();
          ctx.ellipse(700, 440, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.setLineDash([10, 18]);
        ctx.strokeStyle = '#f7f7f2';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(700, 440, 450, 250, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let y = 603; y < 775; y += 12)
          for (let x = 696; x < 720; x += 12) {
            ctx.fillStyle = ((x - 696) / 12 + (y - 603) / 12) % 2 ? '#f7f7f2' : '#263c32';
            ctx.fillRect(x, y, 12, 12);
          }
        ctx.fillStyle = '#263c3280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CIRCUIT 01', 700, 415);
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#263c32';
        ctx.fillText('Find your line.', 700, 451);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#263c329e';
        ctx.fillText('Pass the four checkpoints to complete a lap.', 700, 483);
        const alpha = Math.min(1, Math.max(0, (now - received.current) / (1000 / 30)));
        for (const player of latest.current) {
          let car: Car = player;
          if (player.id === own.current && predicted.current) car = predicted.current;
          else {
            const old = previous.current.find((p) => p.id === player.id);
            if (old)
              car = {
                x: old.x + (player.x - old.x) * alpha,
                y: old.y + (player.y - old.y) * alpha,
                angle:
                  old.angle +
                  Math.atan2(
                    Math.sin(player.angle - old.angle),
                    Math.cos(player.angle - old.angle),
                  ) *
                    alpha,
                speed: player.speed,
              };
          }
          ctx.save();
          ctx.translate(car.x, car.y);
          ctx.rotate(car.angle);
          ctx.globalAlpha = player.connected ? 1 : 0.3;
          ctx.fillStyle = player.id === own.current ? '#263c32' : '#9fbaa8';
          ctx.beginPath();
          ctx.roundRect(-19, -10, 38, 20, 5);
          ctx.fill();
          ctx.fillStyle = '#f7f7f2';
          ctx.fillRect(3, -7, 6, 14);
          ctx.restore();
          ctx.fillStyle = '#263c329e';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(player.id === own.current ? 'YOU' : player.name, car.x, car.y - 21);
        }
      }
      frames++;
      if (now - measure > 400) {
        const me = latest.current.find((p) => p.id === own.current);
        setMetrics({
          speed: Math.round(Math.abs(predicted.current?.speed || 0)),
          fps: Math.round((frames * 1000) / (now - measure)),
          correction: correction.current,
          lap: me?.lap || 0,
          best: me?.best || 0,
          checkpoint: me?.checkpoint || 0,
        });
        frames = 0;
        measure = now;
      }
      last = now;
      void last;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      clearTimeout(reconnect);
      clearInterval(tick);
      clearInterval(ping);
      cancelAnimationFrame(frame);
      for (const timer of timers) clearTimeout(timer);
      socket.current?.close();
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
      window.removeEventListener('blur', blur);
    };
  }, []);
  function join() {
    if (!/^[\w-]{1,32}$/.test(roomInput)) {
      setNotice('Use 1–32 letters, numbers, dashes, or underscores for a room.');
      return;
    }
    sessionStorage.setItem('circuit-name', name.slice(0, 20) || 'Driver');
    location.hash = 'room=' + roomInput + (joinMode === 'spectator' ? '&watch=1' : '');
    location.reload();
  }
  const me = latest.current.find((p) => p.id === own.current);
  return (
    <div className="racer-app">
      <header>
        <a className="brand" href="/">
          ⌁ circuit
        </a>
        <div className="room-controls">
          <span className="small muted">Room {room}</span>
          <button
            onClick={() => {
              void navigator.clipboard
                .writeText(
                  location.origin +
                    location.pathname +
                    '#room=' +
                    room +
                    (spectating ? '&watch=1' : ''),
                )
                .then(() => setNotice('Room link copied. Open it on another tab or browser.'))
                .catch(() => setNotice('Copy the room URL from your address bar.'));
            }}
          >
            {spectating ? 'Copy spectator link' : 'Copy room link'}
          </button>
          <details className="room-menu">
            <summary aria-label="Room settings">•••</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                join();
              }}
            >
              <label>
                Your name
                <input
                  aria-label="Driver name"
                  type="text"
                  value={name}
                  maxLength={20}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Room
                <input
                  aria-label="Room name"
                  type="text"
                  value={roomInput}
                  maxLength={32}
                  onChange={(e) => setRoomInput(e.target.value)}
                />
              </label>
              <label>
                Join as
                <select
                  aria-label="Join as"
                  value={joinMode}
                  onChange={(e) => setJoinMode(e.target.value)}
                >
                  <option value="driver">Driver</option>
                  <option value="spectator">Spectator</option>
                </select>
              </label>
              <button className="primary">Join room</button>
            </form>
          </details>
        </div>
      </header>
      <div className="race-hud">
        {spectating ? (
          <div>
            <span className="muted small">Spectator mode</span>
            <strong>Watching live</strong>
          </div>
        ) : (
          <>
            <div>
              <span className="muted small">Lap</span>
              <strong>{metrics.lap}</strong>
            </div>
            <div>
              <span className="muted small">Best</span>
              <strong>{time(metrics.best)}</strong>
            </div>
            <div>
              <span className="muted small">Speed</span>
              <strong>
                <output aria-label="Car speed">{metrics.speed}</output>
                <small> px/s</small>
              </strong>
            </div>
            <div className="checkpoint">
              <span className="muted small">Checkpoints</span>
              <span>
                {[0, 1, 2, 3].map((i) => (
                  <i key={i} className={metrics.checkpoint > i ? 'passed' : ''} />
                ))}
              </span>
            </div>
            <button
              onClick={() => {
                input.current = controls();
                pending.current = [];
                socket.current?.send(JSON.stringify({ type: 'reset' }));
              }}
              disabled={status !== 'Connected'}
            >
              Reset car ↺
            </button>
          </>
        )}
      </div>
      <main className="race-stage">
        <canvas
          ref={canvas}
          aria-label={
            spectating
              ? 'Live multiplayer racetrack. Spectator view.'
              : 'Multiplayer racetrack. Use arrow keys or WASD to drive.'
          }
        />
        {status !== 'Connected' && (
          <div className="connection-message" role="status">
            {status}
          </div>
        )}
      </main>
      {!spectating && (
        <div className="touch-controls" aria-label="Driving controls">
          {(['left', 'right', 'down', 'up'] as (keyof Controls)[]).map((key) => (
            <button
              key={key}
              aria-label={
                {
                  left: 'Steer left',
                  right: 'Steer right',
                  up: 'Accelerate',
                  down: 'Brake or reverse',
                }[key]
              }
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                input.current[key] = true;
              }}
              onPointerUp={() => {
                input.current[key] = false;
              }}
              onPointerCancel={() => {
                input.current[key] = false;
              }}
            >
              {{ left: '←', right: '→', down: '↓', up: '↑' }[key]}
            </button>
          ))}
        </div>
      )}
      <footer>
        <span>{notice}</span>
        <span>
          {status} · {drivers.filter((p) => p.connected).length}/8 drivers · {rtt || '—'} ms RTT
          {spectators > 0 && ' · ' + spectators + ' watching'}
        </span>
      </footer>
      <section className="race-details">
        <details open={spectating || undefined}>
          <summary>Drivers & lap times</summary>
          <table aria-label="Drivers">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Laps</th>
                <th>Best</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    {p.id === own.current ? ' (you)' : ''}
                    {!p.connected ? ' · reconnecting' : ''}
                  </td>
                  <td>{p.lap}</td>
                  <td>{time(p.best)}</td>
                  <td>{time(p.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <details>
          <summary>Network & performance</summary>
          <div className="diagnostics">
            <label>
              Added round-trip delay
              <select
                aria-label="Simulated round-trip delay"
                value={latency}
                onChange={(e) => setLatency(+e.target.value)}
              >
                <option value="0">None</option>
                <option value="100">100 ms</option>
                <option value="200">200 ms</option>
                <option value="400">400 ms</option>
              </select>
            </label>
            <p>
              {metrics.fps} render fps · 30 Hz server
              <br />
              Last reconciliation: {metrics.correction.toFixed(1)} px
              <br />
              {spectating
                ? 'Receiving live race snapshots'
                : me && onRoad(me.x, me.y)
                  ? 'On track'
                  : 'Grass reduces grip and speed'}
              <br />
              Delay is simulated in this client; measured RTT includes it.
            </p>
          </div>
        </details>
        <a
          className="small muted"
          href="https://github.com/A-Mardi/multiplayer-racer"
          target="_blank"
          rel="noreferrer"
        >
          Source ↗
        </a>
      </section>
    </div>
  );
}
