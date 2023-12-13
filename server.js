require('dotenv').config();
const express = require('express');
const path = require('path');
const mapHandler = require('./api/map');
const validateMapKeyHandler = require('./api/validate-map-key');

const app = express();
const port = process.env.PORT || 8966;

// 使用查询参数处理所有地图请求
app.get('/api/map', mapHandler);

// 设置静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

app.all('/api/validate-map-key', validateMapKeyHandler);

// 启动服务器
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
