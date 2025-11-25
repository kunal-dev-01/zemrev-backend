// ====================================
// src/routes/health.routes.ts
// ====================================

import { Router, Request, Response } from 'express';
import { SERVICES } from '@/config/services.config.js';
import { checkServiceHealth } from '@/utils/health.check.js';
import env from '@/config/env.config.js';

const router: Router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const serviceChecks = await Promise.allSettled([
    checkServiceHealth(SERVICES.AUTH_SERVICE, 'auth-service')
  ]);

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: serviceChecks,
    environment: env.NODE_ENV
  });
});

router.get('/api/services', (_req: Request, res: Response) => {
  res.json({
    services: {
      auth: {
        url: SERVICES.AUTH_SERVICE,
        endpoints: ['/api/v1/auth', '/api/v1/verify', '/api/v1/payment']
      },
      user: {
        url: SERVICES.USER_SERVICE,
        endpoints: ['/api/v1/user']
      },
      credit: {
        url: SERVICES.CREDIT_SERVICE,
        endpoints: ['/api/v1/credit']
      }
    },
    gateway: {
      version: '1.0.0',
      uptime: process.uptime()
    }
  });
});

export default router;