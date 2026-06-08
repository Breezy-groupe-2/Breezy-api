const express = require('express');
const authRoutes = require('./features/auth/auth.routes');

const app = express();

app.use(express.json());

app.use('/api/v1/auth', authRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

module.exports = app;
