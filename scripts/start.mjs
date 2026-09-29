import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const local = resolve(root, '../.tools/go/bin/go.exe');
const go = process.env.GO_BINARY || (existsSync(local) ? local : 'go');
mkdirSync(resolve(root, '.bin'), { recursive: true });
const binary = resolve(root, '.bin/server' + (process.platform === 'win32' ? '.exe' : ''));
const build = spawnSync(go, ['build', '-o', binary, './cmd/server'], {
  cwd: resolve(root, 'server'),
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);
const child = spawn(binary, process.argv.slice(2), { cwd: root, stdio: 'inherit' });
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
