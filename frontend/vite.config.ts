import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Все запросы, начинающиеся с /api, будут перенаправлены на бэкенд
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})