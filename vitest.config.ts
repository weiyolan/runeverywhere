import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests cover the pure seams only (geo/format/validation/filter store) —
// anything importing React Native runtime code stays out of vitest.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
