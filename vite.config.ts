import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { alias, outDirFor, resolveTarget, sharedDefine } from './vite.shared';
import { manifestPlugin } from './manifest.config';

const target = resolveTarget();
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: './',
  publicDir: 'public',
  define: sharedDefine(target),
  resolve: { alias: alias() },
  plugins: [react(), manifestPlugin(target)],
  build: {
    outDir: outDirFor(target),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 0,
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL('./popup.html', import.meta.url)),
        options: fileURLToPath(new URL('./options.html', import.meta.url)),
        sidepanel: fileURLToPath(new URL('./sidepanel.html', import.meta.url)),
        offscreen: fileURLToPath(new URL('./offscreen.html', import.meta.url)),
        viewer: fileURLToPath(new URL('./viewer.html', import.meta.url)),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
