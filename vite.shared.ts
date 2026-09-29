import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vite';

export type BuildTarget = 'chrome' | 'firefox';

export function resolveTarget(): BuildTarget {
  return process.env.TARGET === 'firefox' ? 'firefox' : 'chrome';
}

export function outDirFor(target: BuildTarget): string {
  return target === 'firefox' ? 'dist-firefox' : 'dist';
}

export function sharedDefine(target: BuildTarget): UserConfig['define'] {
  return {
    __TARGET__: JSON.stringify(target),
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    // Lib-mode builds do not replace this automatically; without it React (and
    // other libraries) ship their development builds.
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  };
}

export function srcPath(...parts: string[]): string {
  return fileURLToPath(new URL(`./src/${parts.join('/')}`, import.meta.url));
}

export function alias(): Record<string, string> {
  return { '@': srcPath() };
}
