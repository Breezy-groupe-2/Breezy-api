const express = require('express');

const app = express();

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Feed Service is running' });
});

// Routes will be added here
// app.use('/api/feed', feedRoutes);

module.exports = app;
