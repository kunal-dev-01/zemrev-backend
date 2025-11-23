// ====================================
// src/middleware/proxy.middleware.ts
// ====================================

import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { logger } from '../utils/logger.js';

export const createServiceProxy = (path: string, target: string, opts: Partial<Options> = {}) =>
  createProxyMiddleware(path, {
    target,
    changeOrigin: true,
    ws: opts.ws || false, // WebSocket support for Socket.IO
    onError: (err, _req, res) => {
      logger.error(`Proxy error for ${path}: ${err.message}`);
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: 'Service unavailable. Please try again later.',
          code: 'SERVICE_UNAVAILABLE',
          service: target,
          path: path
        });
      }
    },
    onProxyReq: (proxyReq, req, _res) => {
      if (req.body && req.headers['content-type']?.includes('application/json')) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onProxyRes: (proxyRes, req, _res) => {
      logger.info(`${req.method} ${req.path} -> ${target} | ${proxyRes.statusCode}`);
    },
    timeout: 60000,
    proxyTimeout: 60000,
    ...opts,
  });