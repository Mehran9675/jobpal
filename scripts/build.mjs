import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const target = args.includes('firefox') ? 'firefox' : 'chrome';
const watch = args.includes('--watch');

const root = fileURLToPath(new URL('..', import.meta.url));
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const shell = process.platform === 'win32';
const env = { ...process.env, TARGET: target };
const iconExists = () => existsSync(fileURLToPath(new URL('../public/icons/icon128.png', import.meta.url)));

const steps = [
  { name: 'app', config: 'vite.config.ts' },
  { name: 'content', config: 'vite.content.config.ts' },
  { name: 'background', config: 'vite.background.config.ts' },
];

if (!iconExists()) {
  const result = spawnSync(process.execPath, ['scripts/generate-icons.mjs'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (watch) {
  const children = steps.map((step) =>
    spawn(process.execPath, [viteBin, 'build', '--config', step.config, '--watch'], { cwd: root, stdio: 'inherit', env }),
  );
  process.on('SIGINT', () => {
    for (const child of children) child.kill();
    process.exit(0);
  });
  void shell;
} else {
  for (const step of steps) {
    const result = spawnSync(process.execPath, [viteBin, 'build', '--config', step.config], { cwd: root, stdio: 'inherit', env });
    if (result.status !== 0) {
      console.error(`\n[build] step "${step.name}" failed with exit code ${result.status}`);
      process.exit(result.status ?? 1);
    }
  }
  console.log(`\n[build] ${target} build complete -> ${target === 'firefox' ? 'dist-firefox' : 'dist'}`);
}
