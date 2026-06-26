const express = require('express');
const followRoutes = require('./routes/follow.routes');
const { errorHandler } = require('./shared/error-handler');

const { setupSwagger } = require('./config/swagger');

const app = express();

app.use(express.json());

// Initialize Swagger documentation before API routes
setupSwagger(app);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Follow Service is running' });
});

app.use('/api/v1/users/:id', followRoutes);

app.use(errorHandler);

module.exports = app;
