import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` is a Next.js build-time guard; in vitest it resolves to a
      // throwing module. Alias to an empty shim so server-only files can be
      // unit-tested under jsdom.
      'server-only': fileURLToPath(new URL('./tests/shims/server-only.ts', import.meta.url)),
    },
  },
})
