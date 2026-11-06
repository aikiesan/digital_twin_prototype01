import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base './' garante compatibilidade universal tanto em https://aikiesan.github.io/digital_twin_prototype01/
// quanto localmente no localhost:5173
export default defineConfig({
  base: './',
  plugins: [react()],
})
