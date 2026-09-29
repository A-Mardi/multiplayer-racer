import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const local = resolve(root, '../.tools/go/bin/go.exe');
const go = process.env.GO_BINARY || (existsSync(local) ? local : 'go');
mkdirSync(resolve(root, '.bin'), { recursive: true });
const binary = resolve(root, '.bin/test-server' + (process.platform === 'win32' ? '.exe' : ''));
const build = spawnSync(go, ['build', '-o', binary, './cmd/server'], {
  cwd: resolve(root, 'server'),
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);
const data = mkdtempSync(join(tmpdir(), 'multiplayer-racer-test-'));
const child = spawn(binary, ['--addr', '127.0.0.1:8193', '--data', data], {
  cwd: root,
  stdio: 'inherit',
});
let stopping = false;
const stop = () => {
  stopping = true;
  child.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('close', (code) => {
  rmSync(data, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  process.exitCode = stopping ? 0 : (code ?? 1);
});
