import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import layoutPlugin from './src/vite-plugin-layout'

export default defineConfig({
  plugins: [react(), layoutPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
  },
})
