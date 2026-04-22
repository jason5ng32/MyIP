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

// Set static file directory
frontendApp.use(express.static(path.join(__dirname, './dist')));

// Start static file server
frontendApp.listen(frontEndPort, () => {
  logger.info(`🚀 Static file server ready on http://localhost:${frontEndPort}`);
});
