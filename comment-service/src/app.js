const express = require('express');
const helmet = require('helmet');
const { requestLogger } = require('./middlewares/requestLogger');
const { createLogger } = require('./config/logger');

const { setupSwagger } = require('./config/swagger');

const logger = createLogger();
const app = express();

// Middleware
app.use(helmet());
app.use(express.json());
app.use(requestLogger(logger));

// Initialize Swagger documentation before API routes
setupSwagger(app);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Comment Service is running' });
});

const { getCommentCounts } = require('./controllers/comment.controller');
const { likeComment, unlikeComment } = require('./controllers/comment-like.controller');
const { authenticate } = require('./middlewares/authenticate');
const { requireInternalApiKey } = require('../../shared/middlewares/internalAuth');
const commentRoutes = require('./routes/comment.routes');
const replyRoutes = require('./routes/reply.routes');

// Internal: batched comment counts for post-service (service-to-service only).
app.get('/internal/comment-counts', requireInternalApiKey, getCommentCounts);
// Like / unlike a comment or a reply (id is the comment OR reply id).
app.post('/api/v1/comments/:id/like', authenticate, likeComment);
app.delete('/api/v1/comments/:id/like', authenticate, unlikeComment);
app.use('/api/v1/posts/:postId/comments', commentRoutes);
app.use('/api/v1/comments/:commentId/replies', replyRoutes);

app.use((err, _req, res, _next) => {
  logger.error(err, 'unhandled error');
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.status ?? 500;
  const message = isProduction && statusCode === 500 ? 'Internal server error' : (err.message ?? 'Internal server error');
  res.status(statusCode).json({ error: message });
});

module.exports = app;
