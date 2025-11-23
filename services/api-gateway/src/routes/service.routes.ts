// ====================================
// src/routes/service.routes.ts
// ====================================

import { Router } from 'express';
import { createServiceProxy } from '@/middlewares/proxy.middleware.js';
import { SERVICES } from '@/config/services.config.js';

const router: Router = Router();

// ====================================
// AUTH SERVICE
// ====================================

router.use('/api/v1/auth', createServiceProxy('/api/v1/auth', SERVICES.AUTH_SERVICE));
router.use('/api/v1/account', createServiceProxy('/api/v1/account', SERVICES.AUTH_SERVICE));
router.use('/api/v1/2fa', createServiceProxy('/api/v1/2fa', SERVICES.AUTH_SERVICE));


// ====================================
// USER SERVICE
// ====================================

router.use('/api/v1/profile', createServiceProxy('/api/v1/profile', SERVICES.USER_SERVICE));
router.use('/api/v1/update', createServiceProxy('/api/v1/update', SERVICES.USER_SERVICE));
router.use('/api/v1/settings', createServiceProxy('/api/v1/settings', SERVICES.USER_SERVICE));


// ====================================
// PROJECT SERVICE
// ====================================

router.use('/api/v1/projects', createServiceProxy('/api/v1/projects', SERVICES.PROJECT_SERVICE));
router.use('/api/v1/milestones', createServiceProxy('/api/v1/milestones', SERVICES.PROJECT_SERVICE));
router.use('/api/v1/revision', createServiceProxy('/api/v1/revision', SERVICES.PROJECT_SERVICE));



export default router;