const { createProxyMiddleware } = require('http-proxy-middleware');

const express = require('express');
const path = require('path');
const app = express();
const PORT = 5503;
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:5000',
    changeOrigin: true,
}));

// Serve static files after proxy middleware
app.use(express.static(path.join(__dirname)));

// Catch-all to serve index.html for SPA routing (if needed)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Frontend server running at http://localhost:${PORT}`);
    console.log('Frontend server is ready to proxy API requests to backend.');
});
