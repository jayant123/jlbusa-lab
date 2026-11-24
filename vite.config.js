import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        ostrel: resolve(import.meta.dirname, 'ostrel/index.html'),
        plintha: resolve(import.meta.dirname, 'plintha/index.html'),
        nuithra: resolve(import.meta.dirname, 'nuithra/index.html'),
        halrune: resolve(import.meta.dirname, 'halrune/index.html'),
        vantrik: resolve(import.meta.dirname, 'vantrik/index.html'),
      },
    },
  },
  test: { environment: 'happy-dom', include: ['tests/unit/**/*.test.js'] },
});
