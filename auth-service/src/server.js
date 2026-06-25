const app = require('./app');
const { connectDB } = require('./config/database');
const { env } = require('./config/env');
const { createLogger } = require('./config/logger');

const logger = createLogger();

connectDB().then(() => {
  const server = app.listen(env.port, () => {
    logger.info({ port: env.port }, 'server started');
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
});
