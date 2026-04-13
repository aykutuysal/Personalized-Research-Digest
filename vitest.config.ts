import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Stub `server-only` so server-gated modules can be imported by Vitest.
      // In Next.js route handlers the `react-server` condition picks up the
      // package's own empty.js; Vitest runs under the default condition where
      // the module throws, so we redirect it here.
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
    clearMocks: true,
  },
})
