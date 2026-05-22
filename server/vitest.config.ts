import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@gendraw/contract': path.resolve(__dirname, '../contract/src/index.ts')
    }
  },
  test: {
    environment: 'node',
    globals: true
  }
});
