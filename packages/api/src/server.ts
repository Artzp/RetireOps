import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { db } from './db/connection.js';
import { redis } from './utils/redis.js';

const app = createApp();

// Graceful shutdown handler
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new requests
  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    // Close database connection
    await db.destroy();
    logger.info('Database connection closed');

    // Close Redis connection
    await redis.quit();
    logger.info('Redis connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start server
const server = app.listen(config.PORT, config.HOST, () => {
  logger.info(`Server running on http://${config.HOST}:${String(config.PORT)}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
});

// Handle shutdown signals
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export { server };
