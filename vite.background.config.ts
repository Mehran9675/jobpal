import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { alias, outDirFor, resolveTarget, sharedDefine } from './vite.shared';

const target = resolveTarget();

export default defineConfig({
  publicDir: false,
  define: sharedDefine(target),
  resolve: { alias: alias() },
  build: {
    outDir: outDirFor(target),
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/background/index.ts', import.meta.url)),
      name: 'JobPalBackground',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
