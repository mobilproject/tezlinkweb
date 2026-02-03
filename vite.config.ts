import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use /taxi/ for production, but root / for local dev to avoid "white screen" issues
  base: process.env.NODE_ENV === 'production' ? '/taxi/' : '/',
})
