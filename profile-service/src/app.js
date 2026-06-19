const express = require('express');
const profileRoutes = require('./routes/profile.routes');

const { setupSwagger } = require('./config/swagger');

const app = express();

app.use(express.json());

// Initialize Swagger documentation before API routes
setupSwagger(app);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'Profile Service is running' });
});

app.use('/api/v1/users', profileRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

module.exports = app;
