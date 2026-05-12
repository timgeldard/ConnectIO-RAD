/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@connectio/shared-ui': path.resolve(__dirname, '../../../libs/shared-ui/src'),
      '@connectio/shared-reporting': path.resolve(__dirname, '../../../libs/shared-reporting/src/index.ts'),
    },
  },
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/cq':  { target: 'http://localhost:8000', changeOrigin: true },
      '/poh': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/__tests__/**', 'src/main.tsx'],
      // Ratchet baseline 2026-05-07. Current actuals are below the 75% mandate;
      // raise both numbers each sprint until they reach 75/75/75/75. See TODO.md.
      thresholds: { lines: 60, functions: 65, branches: 75, statements: 60 },
    },
  },
})
