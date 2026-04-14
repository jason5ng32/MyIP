import dotenv, { parse } from 'dotenv';
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { serwist } from '@serwist/vite'
import { CodeInspectorPlugin } from 'code-inspector-plugin';

dotenv.config();

const backEndPort = parseInt(process.env.BACKEND_PORT || 11966, 10);
const frontEndPort = parseInt(process.env.FRONTEND_PORT || 18966, 10);
const nodeModuleChunkGroups = {
  vendor: ['vue', 'vue-router', 'vue-i18n'],
  chart: ['chart.js'],
  speedtest: ['@cloudflare/speedtest'],
  svgmap: ['svgmap'],
  'browser-detect': ['@thumbmarkjs/thumbmarkjs', 'detect-gpu', 'ua-parser-js'],
};

const sourceChunkGroups = {
  'utils-getips': [
    '/frontend/utils/getips/index',
    '/frontend/utils/valid-ip',
    '/frontend/utils/transform-ip-data',
    '/frontend/utils/masked-info'
  ],
  'utils-data': [
    '/frontend/utils/country-name',
    '/frontend/utils/speedtest-colos'
  ],
  'utils-auth': [
    '/frontend/utils/authenticated-fetch'
  ],
  'utils-analytics': [
    '/frontend/utils/use-analytics'
  ]
};

function isNodePackage(normalizedId, packageName) {
  const nodeModulesPath = '/node_modules/';
  const nodeModulesIndex = normalizedId.lastIndexOf(nodeModulesPath);

  if (nodeModulesIndex === -1) {
    return false;
  }

  const packagePath = normalizedId.slice(nodeModulesIndex + nodeModulesPath.length);
  return packagePath === packageName || packagePath.startsWith(`${packageName}/`);
}

function manualChunks(id) {
  const normalizedId = id.replaceAll('\\', '/');

  for (const [chunkName, packages] of Object.entries(nodeModuleChunkGroups)) {
    if (packages.some((packageName) => isNodePackage(normalizedId, packageName))) {
      return chunkName;
    }
  }

  for (const [chunkName, modules] of Object.entries(sourceChunkGroups)) {
    if (modules.some((moduleName) => normalizedId.includes(moduleName))) {
      return chunkName;
    }
  }

  return undefined;
}

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'pwa-install'
        }
      }
    }),
    tailwindcss(),
    serwist({
      swSrc: 'frontend/sw.js',
      swDest: 'sw.js',
      globDirectory: 'dist',
      globPatterns: [
        '**/*.{js,css,woff,woff2}',
        '*.{js,css,png,svg,jpg,webp}',
      ],
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
        manualChunks,
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
