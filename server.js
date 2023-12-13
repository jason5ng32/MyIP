require('dotenv').config();
// Vercel 上不需要 express，因为 Vercel 会自动处理
const express = require('express');
const path = require('path');
const mapHandler = require('./api/map');
const validateMapKeyHandler = require('./api/validate-map-key');

const app = express();
const port = process.env.PORT || 8966;
app.get('/api/map/:latitude,:longitude/:language', mapHandler);

// 设置静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 模拟 Vercel 的无服务器函数
app.all('/api/map', (req, res) => {
    req.query = { ...req.params, ...req.query }; // 合并 params 和 query
    mapHandler(req, res);
});

app.all('/api/validate-map-key', validateMapKeyHandler);

// 启动服务器
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
