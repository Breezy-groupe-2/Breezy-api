const express = require('express');

const { setupSwagger } = require('./config/swagger');

const app = express();

// Middleware
app.use(express.json());

// Initialize Swagger documentation before API routes
setupSwagger(app);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Comment Service is running' });
});

const commentRoutes = require('./routes/comment.routes');
const replyRoutes = require('./routes/reply.routes');
app.use('/api/v1/posts/:postId/comments', commentRoutes);
app.use('/api/v1/comments/:commentId/replies', replyRoutes);

app.use((err, _req, res, _next) => {
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

module.exports = app;
