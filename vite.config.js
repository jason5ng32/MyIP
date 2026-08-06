import dotenv, { parse } from 'dotenv';
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { CodeInspectorPlugin } from 'code-inspector-plugin';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { PREFS_STORAGE_KEY } from './frontend/data/default-preferences.js';

dotenv.config();

// Sentry source-map upload — build-time only. Needs SENTRY_AUTH_TOKEN and a
// production SENTRY_ENVIRONMENT (unset means production, matching the
// backend convention) — dev/test builds neither generate nor upload maps.
// Maps go to Sentry, then get deleted from dist/ — users never download them.
const sentryUploadEnabled = !!process.env.SENTRY_AUTH_TOKEN
  && (process.env.SENTRY_ENVIRONMENT || 'production') === 'production';

const backEndPort = parseInt(process.env.BACKEND_PORT || 11966, 10);
const frontEndPort = parseInt(process.env.FRONTEND_PORT || 18966, 10);
const nodeModuleChunkGroups = {
  vendor: ['vue', 'vue-router', 'vue-i18n'],
  chart: ['chart.js'],
  speedtest: ['@cloudflare/speedtest'],
  svgmap: ['svgmap'],
  'browser-detect': ['@thumbmarkjs/thumbmarkjs', 'ua-parser-js'],
};

const sourceChunkGroups = {
  'utils-getips': [
    '/frontend/utils/getips/index',
    '/frontend/utils/valid-ip',
    '/frontend/utils/transform-ip-data'
  ],
  'utils-auth': [
    '/frontend/utils/authenticated-fetch'
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

// `index.html` contains a small conditional block delimited by
// `<!-- @site-url:open -->` … `<!-- @site-url:close -->` and uses
// `__SITE_URL__` as the placeholder for an absolute origin.
function siteUrlHtmlPlugin() {
  const siteUrl = (process.env.VITE_SITE_URL || '').trim().replace(/\/+$/, '');
  const blockRe = /[ \t]*<!--\s*@site-url:open\s*-->[\s\S]*?<!--\s*@site-url:close\s*-->\n?/g;
  const markerOpenRe = /[ \t]*<!--\s*@site-url:open\s*-->\n?/g;
  const markerCloseRe = /[ \t]*<!--\s*@site-url:close\s*-->\n?/g;
  return {
    name: 'site-url-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!siteUrl) return html.replace(blockRe, '');
        return html
          .replace(markerOpenRe, '')
          .replace(markerCloseRe, '')
          .replaceAll('__SITE_URL__', siteUrl);
      },
    },
  };
}

// Build-only inline script that modulepreloads the visitor's locale pack.
// Mount waits on the active locale's messages, but their dynamic import can
// only start after index.js has downloaded and executed — a serialized
// round-trip on the boot critical path. This plugin finds the emitted
// locale-pack chunks in the bundle and injects a small head script that
// picks the language exactly like locales/i18n.js (stored prefs →
// ?hl= → browser language → en) and appends
// <link rel="modulepreload"> for it (plus the en fallback pack, which
// non-English boots also await) while the HTML is still streaming — the
// packs then download in parallel with the main bundle. A wrong pick only
// wastes one preload; the real import decides. Dev serves no bundle, so
// nothing is injected there.
const localePreloadPlugin = () => {
  const preloadScript = (chunks) => `(function () {
  var chunks = ${JSON.stringify(chunks)};
  var lang = null;
  try {
    var stored = JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_STORAGE_KEY)}) || '{}').lang;
    if (chunks[stored]) lang = stored;
  } catch (e) { /* malformed entry — fall through to the default pick */ }
  if (!lang) {
    var hl = new URLSearchParams(location.search).get('hl');
    if (hl) {
      lang = chunks[hl] ? hl : 'en';
    } else {
      var bl = (navigator.language || '').slice(0, 2).toLowerCase();
      lang = chunks[bl] ? bl : 'en';
    }
  }
  (lang === 'en' ? ['en'] : [lang, 'en']).forEach(function (l) {
    if (!chunks[l]) return;
    var link = document.createElement('link');
    link.rel = 'modulepreload';
    link.crossOrigin = '';
    link.href = chunks[l];
    document.head.appendChild(link);
  });
})();`;

  return {
    name: 'locale-preload',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const chunks = {};
        for (const [fileName, chunk] of Object.entries(ctx.bundle || {})) {
          if (chunk.type !== 'chunk') continue;
          const facade = (chunk.facadeModuleId || '').replaceAll('\\', '/');
          const match = facade.match(/\/frontend\/locales\/([a-z]{2})\.json$/);
          if (match) chunks[match[1]] = '/' + fileName;
        }
        if (Object.keys(chunks).length === 0) return html;
        return {
          html,
          tags: [{ tag: 'script', children: preloadScript(chunks), injectTo: 'head' }],
        };
      },
    },
  };
};

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
    siteUrlHtmlPlugin(),
    localePreloadPlugin(),
    CodeInspectorPlugin({
      bundler: 'vite',
      hideDomPathAttr: true,
      behavior: {
        copy: '{file}',
      },
    }),
    // Must stay last so it sees the final emitted chunks. Release name
    // defaults to the current git commit SHA; the plugin injects the same
    // release into the SDK at runtime, tying events to their sourcemaps.
    sentryUploadEnabled && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT_FRONTEND,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      sourcemaps: {
        // Rolldown's module-loading runtime chunk has no source to map —
        // skip it so every build doesn't warn about its missing .map
        ignore: ['**/rolldown-runtime*.js'],
        filesToDeleteAfterUpload: ['dist/**/*.map'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/frontend',
    },
  },
  build: {
    // Hidden sourcemaps exist only for the Sentry upload; without a token,
    // don't generate them at all (they'd end up publicly served from dist/)
    sourcemap: sentryUploadEnabled ? 'hidden' : false,
    rollupOptions: {
      // @vueuse/core ships a couple of /* #__PURE__ */ comments in positions
      // Rolldown (Vite 8's new bundler) can't interpret. They're harmless —
      // just slightly less aggressive tree-shaking for those call sites —
      // but the warnings clutter every build. Filter them out and let
      // everything else through. Drop this once @vueuse/core fixes positions.
      onwarn(warning, defaultHandler) {
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('@vueuse/core')) {
          return;
        }
        defaultHandler(warning);
      },
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
    },
    allowedHosts: ['dev.ipcheck.ing', 'test.ipcheck.ing'],
  }
})
