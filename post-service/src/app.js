const express = require('express');

const app = express();

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Post Service is running' });
});

// Routes will be added here
// app.use('/api/posts', postRoutes);

module.exports = app;
