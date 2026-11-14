import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@contracts': fileURLToPath(new URL('../contracts', import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://127.0.0.1:8000' }, // 127.0.0.1: evita que Windows intente IPv6 (::1),
  },
})
