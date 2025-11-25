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
router.use('/api/v1/verify', createServiceProxy('/api/v1/verify', SERVICES.AUTH_SERVICE));
router.use('/api/v1/payment', createServiceProxy('/api/v1/payment', SERVICES.AUTH_SERVICE));


// ====================================
// USER SERVICE
// ====================================

router.use('/api/v1/user', createServiceProxy('/api/v1/user', SERVICES.USER_SERVICE));



// ====================================
// CREDIT SERVICE
// ====================================

router.use('/api/v1/credit', createServiceProxy('/api/v1/credit', SERVICES.CREDIT_SERVICE));




export default router;