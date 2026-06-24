const app = require('./app');
const { createLogger } = require('./config/logger');

const logger = createLogger();

const PORT = process.env.PORT || 3005;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'server started');
});

const shutdown = (signal) => {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
