import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 950,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/src/spc/SPCContext.tsx') ||
            id.includes('/src/spc/types.ts') ||
            id.includes('/src/spc/hooks/useSPCUrlSync.ts') ||
            id.includes('/src/spc/hooks/useSPCPreferences.ts')
          ) {
            return 'spc-core'
          }
          if (id.includes('node_modules/framer-motion/')) return 'motion'
          if (id.includes('node_modules/zrender/')) return 'zrender'
          if (id.includes('node_modules/echarts/')) return 'echarts-core'
          if (id.includes('node_modules/echarts-for-react/')) return 'echarts-react'
          if (id.includes('node_modules/d3-') || id.includes('node_modules/react-d3-tree')) return 'process-flow'
        },
      },
    },
  },
})
