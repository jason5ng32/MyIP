import dotenv from 'dotenv';
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

dotenv.config();

const apiPort = process.env.PORT || 11966;

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 18966,
    proxy: {
      '/api': `http://localhost:${apiPort}`
    }
  }
})
