// ====================================
// src/config/services.config.ts
// ====================================

import env from './env.config.js';

export const SERVICES = {
  AUTH_SERVICE: env.AUTH_SERVICE_URL,
  USER_SERVICE: env.USER_SERVICE_URL,
  NOTIFICATION_SERVICE: env.NOTIFICATION_SERVICE_URL,
  PROJECT_SERVICE: env.PROJECT_SERVICE_URL
};

export const SERVICE_ROUTES = {
  AUTH: {
    paths: ['/api/v1/auth', '/api/v1/2fa'],
    target: SERVICES.AUTH_SERVICE
  }
};