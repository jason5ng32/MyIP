// frontend-server.js
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const frontendApp = express();
const backEndPort = parseInt(process.env.BACKEND_PORT || 11966, 10);
const frontEndPort = parseInt(process.env.FRONTEND_PORT || 18966, 10);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API 请求代理到后端服务
frontendApp.use('/api', createProxyMiddleware({ 
  target: `http://localhost:${backEndPort}/api`,
  changeOrigin: true
}));

// 设置静态文件目录
frontendApp.use(express.static(path.join(__dirname, './dist')));

// 启动静态文件服务
frontendApp.listen(frontEndPort, () => {
  console.log(`Static file server running on port http://localhost:${frontEndPort}`);
});
