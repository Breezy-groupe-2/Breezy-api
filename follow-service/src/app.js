const express = require('express');
const followRoutes = require('./routes/follow.routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Follow Service is running' });
});

app.use('/api/v1/users/:id', followRoutes);

app.use((err, _req, res, _next) => {
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

module.exports = app;
