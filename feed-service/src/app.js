const express = require('express');
const helmet = require('helmet');
const feedRoutes = require('./routes/feed.routes');
const { requestLogger } = require('./middlewares/requestLogger');
const { createLogger } = require('./config/logger');

const { setupSwagger } = require('./config/swagger');

const logger = createLogger();
const app = express();

app.use(helmet());
app.use(express.json());
app.use(requestLogger(logger));

// Initialize Swagger documentation before API routes
setupSwagger(app);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Feed Service is running' });
});

app.use('/api/v1/feed', feedRoutes);

app.use((err, _req, res, _next) => {
  logger.error(err, 'unhandled error');
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.status ?? 500;
  const message = isProduction && statusCode === 500 ? 'Internal server error' : (err.message ?? 'Internal server error');
  res.status(statusCode).json({ error: message });
});

module.exports = app;
