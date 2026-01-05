import dotenv, { parse } from 'dotenv';
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { CodeInspectorPlugin } from 'code-inspector-plugin';

dotenv.config();

const backEndPort = parseInt(process.env.BACKEND_PORT || 11966, 10);
const frontEndPort = parseInt(process.env.FRONTEND_PORT || 18966, 10);

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
          '**/*.{js,css,woff,woff2}',
          '*.{js,css,png,svg,jpg,webp}',
        ],
        navigateFallback: null, // 禁用默认 navigateFallback，使用自定义 HTML 缓存策略
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => {
              // 匹配 HTML 文档请求（导航请求）
              return request.mode === 'navigate' || url.pathname.endsWith('.html');
            },
            handler: 'NetworkFirst', // 优先从网络获取最新版本
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60, // 1 小时，较短的缓存时间
              },
              networkTimeoutSeconds: 3, // 3秒网络超时后使用缓存
            },
          },
          {
            urlPattern: /\/(sw\.js|registerSW\.js|manifest\.webmanifest)$/, // sw 文件
            handler: 'NetworkFirst',
            options: {
              cacheName: 'critical-assets',
              expiration: {
                maxEntries: 3,
                maxAgeSeconds: 4 * 60 * 60, // 4 小时
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|woff|woff2)$/, // 图片文件
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 天
              },
            },
          },
          {
            urlPattern: /\.(?:js|css)$/, // JS 和 CSS 文件
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'assets',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 3 * 24 * 60 * 60, // 3 天
              },
            },
          },
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
            src: '/logos/logo-192.webp',
            sizes: '192x192',
            type: 'image/webp',
            purpose: 'maskable'
          },
          {
            src: '/logos/ios-logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/logos/ios-logo-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
    CodeInspectorPlugin({
      bundler: 'vite',
      hideDomPathAttr: true,
      behavior: {
        copy: '{file}',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/frontend',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'vue-i18n'],
          'chart': ['chart.js/auto'],
          'speedtest': ['@cloudflare/speedtest'],
          'svgmap': ['svgmap'],
          'browser-detect': ['@thumbmarkjs/thumbmarkjs', 'detect-gpu', 'ua-parser-js'],
          'utils-getips': [
            '@/utils/getips/index',
            '@/utils/valid-ip',
            '@/utils/transform-ip-data',
            '@/utils/masked-info'
          ],
          'utils-data': [
            '@/utils/country-name',
            '@/utils/speedtest-colos'
          ],
          'utils-auth': [
            '@/utils/authenticated-fetch'
          ],
          'utils-analytics': [
            '@/utils/use-analytics'
          ]
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.fileName && (assetInfo.fileName.endsWith('.woff') || assetInfo.fileName.endsWith('.woff2'))) {
            return 'fonts/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: (chunkInfo) => {
          const prefix = chunkInfo.name.startsWith('utils-') ? 'utils/' : '';
          return `assets/${prefix}[name].[hash].js`;
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      maxSize: 500000,
    }
  },
  server: {
    host: '0.0.0.0',
    port: frontEndPort,
    proxy: {
      '/api': `http://localhost:${backEndPort}`
    }
  }
})
