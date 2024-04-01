import dotenv from 'dotenv';
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { CodeInspectorPlugin } from 'code-inspector-plugin';

dotenv.config();

const apiPort = process.env.PORT || 11966;

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'pwa-install'
        }
      }
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,woff,woff2}',
          '*.{js,css,html,png,svg,jpg,webp}',
        ]
      },
      manifest: {
        name: 'IPCheck.ing',
        short_name: 'IPCheck.ing',
        theme_color: '#f8f9fa',
        orientation: "portrait",
        id: 'com.jasonng.myip',
        description: 'All in one IP Toolbox',
        icons: [
          {
            src: '/logo-192.webp',
            sizes: '192x192',
            type: 'image/webp',
            purpose: 'maskable'
          },
          {
            src: '/ios-logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/ios-logo-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
    CodeInspectorPlugin({
      bundler: 'vite',
      behavior: {
        copy: '{file}',
      },
    }),
  ],
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
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.woff') || assetInfo.name.endsWith('.woff2')) {
            return 'fonts/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
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
