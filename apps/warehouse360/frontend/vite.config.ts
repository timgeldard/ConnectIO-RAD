import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
      '@connectio/shared-ui': path.resolve(__dirname, '../../../libs/shared-ui'),
      '@connectio/shared-reporting': path.resolve(__dirname, '../../../libs/shared-reporting'),
      '@connectio/shared-app-context': path.resolve(__dirname, '../../../libs/shared-app-context'),
      '@connectio/shared-frontend-i18n': path.resolve(__dirname, '../../../libs/shared-frontend-i18n'),
      '@connectio/shared-frontend-api': path.resolve(__dirname, '../../../libs/shared-frontend-api'),
    },
  },
  server: {
    proxy: {
      '/api/wh360': { target: 'http://localhost:8004', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react'
            }
            return 'vendor'
          }
        },
      },
    },
  },
})
