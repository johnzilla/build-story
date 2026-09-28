import { defineConfig } from 'vitest/config'

export default defineConfig({ test: {
  include: ['src/acceptance/*.acceptance.ts'],
  testTimeout: 300_000,
  hookTimeout: 300_000,
  fileParallelism: false,
} })
