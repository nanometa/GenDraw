import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Vite dev server + React plugin. Tailwind is handled via PostCSS (postcss.config.js).
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Alias entries are matched in order. The subpath aliases must come
    // before the bare `@gendraw/contract` entry so they win on resolution.
    alias: [
      {
        find: '@gendraw/contract/abi.json',
        replacement: path.resolve(__dirname, '../contract/src/abi.json')
      },
      {
        find: '@gendraw/contract/config',
        replacement: path.resolve(__dirname, '../contract/src/config.ts')
      },
      {
        find: '@gendraw/contract/types',
        replacement: path.resolve(__dirname, '../contract/src/types.ts')
      },
      {
        find: '@gendraw/contract',
        replacement: path.resolve(__dirname, '../contract/src/index.ts')
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, 'src')
      }
    ]
  },
  server: {
    port: 5173,
    strictPort: false
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false
  }
});
