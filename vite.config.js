import dotenv from 'dotenv';
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

dotenv.config();

const apiPort = process.env.PORT || 11966;

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: '0.0.0.0',
    port: 18966,
    proxy: {
      '/api': `http://localhost:${apiPort}`
    }
  }
})
