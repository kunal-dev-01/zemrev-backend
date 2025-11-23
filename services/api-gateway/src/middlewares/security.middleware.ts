// ====================================
// src/middleware/security.middleware.ts
// ====================================

import helmet from 'helmet';
import compression from 'compression';
import type { RequestHandler } from "express";

export const securityMiddleware: RequestHandler[] = [
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }) as RequestHandler,
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }) as RequestHandler
];

export const compressionMiddleware: RequestHandler = compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}) as RequestHandler;
