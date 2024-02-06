import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mapHandler from './api/map.js';
import validateMapKeyHandler from './api/validate-map-key.js';
import validateSite from './api/validate-site.js';
import ipinfoHandler from './api/ipinfo.js';
import ipapicomHandler from './api/ipapicom.js';
import keycdnHandler from './api/keycdn.js';
import ipCheckingHandler from './api/ipchecking.js';
import ipsbHandler from './api/ipsb.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 11966;

// 使用查询参数处理所有地图请求
app.get('/api/map', mapHandler);

// 使用查询参数处理所有 IP 地址请求
app.get('/api/ipinfo', ipinfoHandler);
app.get('/api/ipapicom', ipapicomHandler);
app.get('/api/keycdn', keycdnHandler);
app.get('/api/ipchecking', ipCheckingHandler);
app.get('/api/ipsb', ipsbHandler);

// 设置静态文件服务
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, './dist')));

// 一些判断
app.all('/api/validate-map-key', validateMapKeyHandler);
app.all('/api/validate-site', validateSite);

// 启动服务器
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
