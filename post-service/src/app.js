const express = require('express');
const postRoutes = require('./routes/post/post.routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Post Service is running' });
});

app.use('/api/v1/posts', postRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

module.exports = app;
