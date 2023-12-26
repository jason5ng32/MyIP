require('dotenv').config();
const express = require('express');
const path = require('path');
const mapHandler = require('./api/map');
const validateMapKeyHandler = require('./api/validate-map-key');
const validateSite = require('./api/validate-site');
const ipinfoHandler = require('./api/ipinfo');
const ipapicomHandler = require('./api/ipapicom');

const app = express();
const port = process.env.PORT || 8966;

// 使用查询参数处理所有地图请求
app.get('/api/map', mapHandler);

// 使用查询参数处理所有 IP 地址请求
app.get('/api/ipinfo', ipinfoHandler);
app.get('/api/ipapicom', ipapicomHandler);

// 设置静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 一些判断
app.all('/api/validate-map-key', validateMapKeyHandler);
app.all('/api/validate-site', validateSite);

// 启动服务器
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
