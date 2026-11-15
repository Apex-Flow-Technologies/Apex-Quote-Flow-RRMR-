import { defineConfig } from 'vitest/config';

// Security-rules tests need the Firestore emulator: `npm run test:rules`
export default defineConfig({
  test: { include: ['rules-tests/**/*.test.ts'], environment: 'node', testTimeout: 20000, fileParallelism: false },
});
