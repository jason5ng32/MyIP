import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mapHandler from './api/map.js';
import ipinfoHandler from './api/ipinfo.js';
import ipapicomHandler from './api/ipapicom.js';
import keycdnHandler from './api/keycdn.js';
import ipCheckingHandler from './api/ipchecking.js';
import ipsbHandler from './api/ipsb.js';
import cfHander from './api/cfradar.js';
import recaptchaHandler from './api/recaptcha.js';
import validateConfigs from './api/configs.js';
import dnsResolver from './api/dnsresolver.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 11966;

// APIs
app.get('/api/map', mapHandler);
app.get('/api/ipinfo', ipinfoHandler);
app.get('/api/ipapicom', ipapicomHandler);
app.get('/api/keycdn', keycdnHandler);
app.get('/api/ipchecking', ipCheckingHandler);
app.get('/api/ipsb', ipsbHandler);
app.get('/api/cfradar', cfHander);
app.get('/api/recaptcha', recaptchaHandler);

// DNS Resolver
app.get('/api/dnsresolver', dnsResolver);

// 使用查询参数处理所有配置请求
app.get('/api/configs', validateConfigs);

// 设置静态文件服务
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, './dist')));


// 启动服务器
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
