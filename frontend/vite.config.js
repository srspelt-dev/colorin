import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 61234,
    watch: {
      usePolling: true,
    },
    allowedHosts: ['colorin.manco.app', 'api-colorin.manco.app'],
  },
})
