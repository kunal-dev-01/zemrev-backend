// ====================================
// src/config/services.config.ts
// ====================================

import env from './env.config.js';

export const SERVICES = {
  AUTH_SERVICE: env.AUTH_SERVICE_URL,
  USER_SERVICE: env.USER_SERVICE_URL,
  CREDIT_SERVICE: env.CREDIT_SERVICE_URL,
};

export const SERVICE_ROUTES = {
  AUTH: {
    paths: ['/api/v1/auth', '/api/v1/auth/verify' , '/api/v1/payment'],
    target: SERVICES.AUTH_SERVICE
  },
  USER: {
    paths: ['/api/v1/user'],
    target: SERVICES.USER_SERVICE
  },
  CREDIT: {
    paths: ['/api/v1/credit'],
    target: SERVICES.CREDIT_SERVICE
  }
};