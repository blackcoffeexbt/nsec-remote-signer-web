import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        flash: resolve(__dirname, 'flash.html'),
        manual: resolve(__dirname, 'manual.html'),
      }
    }
  },
  publicDir: 'public'
}) 