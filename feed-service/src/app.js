const express = require('express');
const feedRoutes = require('./routes/feed.routes');
const { errorHandler } = require('./shared/error-handler');

const { setupSwagger } = require('./config/swagger');

const app = express();

app.use(express.json());

// Initialize Swagger documentation before API routes
setupSwagger(app);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Feed Service is running' });
});

app.use('/api/v1/feed', feedRoutes);

app.use(errorHandler);

module.exports = app;
