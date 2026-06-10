const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const gatewayConfig = require('./config/gateway.config');

const app = express();

// Middleware
app.use(cors());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'API Gateway is running' });
});

// Proxy to Auth Service
app.use(
  createProxyMiddleware('/api/v1/auth', {
    target: gatewayConfig.authServiceUrl,
    changeOrigin: true,
  })
);

// Proxy to Post Service
app.use(
  createProxyMiddleware('/api/v1/posts', {
    target: gatewayConfig.postServiceUrl,
    changeOrigin: true,
  })
);

// Proxy to Comment Service
app.use(
  createProxyMiddleware('/api/v1/comments', {
    target: gatewayConfig.commentServiceUrl,
    changeOrigin: true,
  })
);

// Proxy to Feed Service
app.use(
  createProxyMiddleware('/api/v1/feed', {
    target: gatewayConfig.feedServiceUrl,
    changeOrigin: true,
  })
);

module.exports = app;
