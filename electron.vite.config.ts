import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve('electron/main/index.ts'),
      },
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@': resolve('src') },
    },
  },
  preload: {
    build: {
      lib: {
        entry: resolve('electron/preload/index.ts'),
      },
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: 'renderer',
    build: {
      rollupOptions: {
        input: resolve('renderer/index.html'),
      },
    },
    resolve: {
      alias: { '@renderer': resolve('renderer/src') },
    },
    plugins: [react()],
    css: {
      postcss: './postcss.config.js',
    },
  },
});
