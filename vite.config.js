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
      },
    },
  },
  test: { environment: 'happy-dom', include: ['tests/unit/**/*.test.js'] },
});
