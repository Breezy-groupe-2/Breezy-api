const mongoose = require('mongoose');
const app = require('./app');
const { env } = require('./config/env');
const { createLogger } = require('./config/logger');

const logger = createLogger();

mongoose
  .connect(env.mongodbUri)
  .then(() => {
    const server = app.listen(env.port, () => {
      logger.info({ port: env.port }, 'server started');
    });

    const shutdown = (signal) => {
      logger.info({ signal }, 'shutting down');
      server.close(() => {
        mongoose.connection.close(false, () => {
          logger.info('server closed');
          process.exit(0);
        });
      });
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    logger.error(err, 'server failed to start');
    process.exit(1);
  });
