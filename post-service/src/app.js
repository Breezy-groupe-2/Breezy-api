const express = require('express');
const postRoutes = require('./routes/post/post.routes');
const mediaRoutes = require('./routes/media/media.routes');

const { setupSwagger } = require('./config/swagger');

const app = express();

app.use(express.json());

// Initialize Swagger documentation before API routes
setupSwagger(app);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Post Service is running' });
});

app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/media', mediaRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

module.exports = app;
