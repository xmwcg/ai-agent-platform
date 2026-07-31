// serve.js - 前端静态资源 + /api 反向代理
const express = require('express');
const path = require('path');
const { execFileSync } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8081;

// 统一静态资源 MIME 与缓存策略。
app.use((req, res, next) => {
    if (req.path.endsWith('.js') || req.path.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-transform, public, max-age=31536000, immutable');
    } else if (req.path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.setHeader('Cache-Control', 'no-transform, public, max-age=31536000, immutable');
    } else if (req.path.endsWith('.svg') || req.path.endsWith('.png') || req.path.endsWith('.jpg') || req.path.endsWith('.ico') || req.path.endsWith('.webp')) {
        res.setHeader('Cache-Control', 'no-transform, public, max-age=31536000, immutable');
    }
    next();
});

// API 代理优先于 SPA fallback。
const apiProxy = createProxyMiddleware({
    pathRewrite: (p) => '/api' + p,
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
    on: {
        error: (err, req, res) => {
            console.error('[proxy] API 代理错误:', err.message);
            if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '后端服务暂时不可用，请稍后重试' }));
            }
        },
    },
});
app.use('/api', apiProxy);

// CS 公开对话 API 代理。
const csProxy = createProxyMiddleware({
    pathRewrite: (p) => '/cs' + p,
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
    on: {
        error: (err, req, res) => {
            console.error('[proxy] CS 代理错误:', err.message);
            if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '后端服务暂时不可用，请稍后重试' }));
            }
        },
    },
});
app.use('/cs', csProxy);

const distPath = path.join(__dirname, '..', 'client', 'dist');

// 启动前验证 Vite 入口与全部动态 chunk，避免部署出“入口已更新、资源缺失”的半包。
execFileSync(process.execPath, [path.join(__dirname, 'verify-dist-integrity.mjs'), distPath], {
    stdio: 'inherit',
});
app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-transform, public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            res.setHeader('Cache-Control', 'no-transform, public, max-age=31536000, immutable');
        } else if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (filePath.endsWith('.svg') || filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.ico') || filePath.endsWith('.webp')) {
            res.setHeader('Cache-Control', 'no-transform, public, max-age=31536000, immutable');
        }
    },
}));

// 缺失构建资源必须返回真正的 404。返回 index.html 会导致浏览器把 HTML 当 JS 解析。
app.get('/assets/{*splat}', (req, res) => {
    res.status(404).type('text/plain; charset=utf-8').send('Asset not found');
});

// SPA fallback：只为前端路由返回 index.html。
app.get('/{*splat}', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/cs')) {
        return res.status(502).json({ error: '后端服务暂时不可用，请稍后重试' });
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '::', () => {
    console.log('Frontend + API server running on http://0.0.0.0:' + PORT);
});
