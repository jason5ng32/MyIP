// frontend-server.js
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from './common/logger.js';

dotenv.config({ quiet: true });

const frontendApp = express();
const backEndPort = parseInt(process.env.BACKEND_PORT || 11966, 10);
const frontEndPort = parseInt(process.env.FRONTEND_PORT || 18966, 10);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API Proxy to backend server
frontendApp.use('/api', createProxyMiddleware({ 
  target: `http://localhost:${backEndPort}/api`,
  changeOrigin: true
}));

// Set static file directory.
// Cache-Control is set per-asset class so the static layer behaves well
// even when no CDN sits in front of it (CF in production sets its own
// Browser TTL on top of these, so the longer values are upper bounds):
//   - dist/assets/**       Vite-hashed JS/CSS/images — content-addressed → 1y immutable
//   - dist/fonts/**        non-hashed but essentially never change → 1y immutable
//   - top-level images     favicon / logos / achievements / … → 24h
//   - index.html + manifest never cache — otherwise stale HTML keeps pointing
//                          at a hashed chunk that no longer exists post-deploy
//   - everything else      (robots.txt, …) → 1h
const distDir = path.join(__dirname, './dist');

function setStaticHeaders(res, filePath) {
  const rel = path.relative(distDir, filePath).replaceAll(path.sep, '/');

  if (rel.startsWith('assets/') || rel.startsWith('fonts/')) {
    res.setHeader('Cache-Control', `public, max-age=${24 * 60 * 60 * 365}, immutable`);
  } else if (/\.(png|jpg|jpeg|webp|svg|ico)$/i.test(rel)) {
    res.setHeader('Cache-Control', `public, max-age=${24 * 60 * 60}`);
  } else if (rel.endsWith('.html') || rel === 'manifest.webmanifest') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  } else {
    res.setHeader('Cache-Control', `public, max-age=${60 * 60}`);
  }
}

frontendApp.use(express.static(distDir, { setHeaders: setStaticHeaders }));

// Start static file server
frontendApp.listen(frontEndPort, () => {
  logger.info(`🚀 Static file server ready on http://localhost:${frontEndPort}`);
});
