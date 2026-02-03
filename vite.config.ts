import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use /taxi/ for production build, root / for local dev
  base: command === 'build' ? '/taxi/' : '/',
}));
