// ====================================
// src/index.ts
// ====================================

import app from './app.js';
import env from './config/env.config.js';
import { logger } from './utils/logger.js';

const PORT = env.PORT;

// --------------------
// Start Server
// --------------------
const server = app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`Services info: http://localhost:${PORT}/api/services`);
});

// --------------------
// Graceful Shutdown
// --------------------
process.on('SIGTERM', () => {
  logger.warn('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.warn('SIGINT received (Ctrl+C), shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
