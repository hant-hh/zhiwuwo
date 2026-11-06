import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发期通过代理把 /api 转发到后端（默认 http://localhost:8000，可用 VITE_API_BASE_URL 覆盖）
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: (process.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, ''),
        changeOrigin: true,
      },
    },
  },
})
