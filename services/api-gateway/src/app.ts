// ====================================
// src/app.ts
// ====================================

import express, { type Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';

// Configs
import env from './config/env.config.js';
import { corsOptions } from './config/cors.config.js';

// Middlewares
import { securityMiddleware, compressionMiddleware } from './middlewares/security.middleware.js';
import { globalErrorHandler, handleUncaughtException } from '@zemrev/utils';

// Routes
import healthRoutes from './routes/health.routes.js';
import serviceRoutes from './routes/service.routes.js';

const app: Express = express();

// --------------------
// Security & Compression
// --------------------
app.use(securityMiddleware);
app.use(compressionMiddleware);

// --------------------
// CORS & Parsing
// --------------------
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// --------------------
// Routes
// --------------------
app.use('/', healthRoutes);
app.use('/', serviceRoutes);

// --------------------
// Error Handling
// --------------------
app.use('*', handleUncaughtException);
app.use(globalErrorHandler);

export default app;
