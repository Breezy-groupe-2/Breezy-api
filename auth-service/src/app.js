const express = require('express');
const helmet = require('helmet');
const userRoutes = require('./routes/user/user.routes');
const moderationRoutes = require('./routes/user/user.moderation.routes');
const adminModerationRoutes = require('./routes/moderation.routes');
const {
  internalUserSummary,
  internalUserByUsername,
  internalUsersByIds,
  syncFollowing,
  syncUnfollowing,
  me,
  getSuggestions,
  searchUsers,
  getPublicUser,
  updateMe,
  updatePreferences,
} = require('./controllers/auth.controller');
const { authenticate } = require('./middlewares/authenticate');
const { checkActive } = require('./middlewares/checkActive');
const {
  validate,
  updatePreferencesSchema,
  updateProfileSchema,
} = require('./middlewares/validate');
const { requestLogger } = require('./middlewares/requestLogger');
const { createLogger } = require('./config/logger');
const { requireInternalApiKey } = require('../../shared/middlewares/internalAuth');

const { setupSwagger } = require('./config/swagger');

const logger = createLogger();
const app = express();

app.use(helmet());
app.use(express.json());
app.use(requestLogger(logger));

// Initialize Swagger documentation before API routes
setupSwagger(app);

app.use('/api/v1/auth', userRoutes);
app.get('/internal/users', requireInternalApiKey, internalUsersByIds);
app.get('/internal/users/by-username/:username', requireInternalApiKey, internalUserByUsername);
app.get('/internal/users/:id', requireInternalApiKey, internalUserSummary);
// follow-service keeps the follow graph in sync here (service-to-service only).
app.put('/internal/users/:followerId/following/:followingId', requireInternalApiKey, syncFollowing);
app.delete('/internal/users/:followerId/following/:followingId', requireInternalApiKey, syncUnfollowing);
app.get('/api/v1/users/me', authenticate, checkActive, me);
app.put(
  '/api/v1/users/me',
  authenticate,
  checkActive,
  validate(updateProfileSchema),
  updateMe
);
app.patch(
  '/api/v1/users/me/preferences',
  authenticate,
  checkActive,
  validate(updatePreferencesSchema),
  updatePreferences
);
// Suggested users to follow (must be registered before the :id route).
app.get('/api/v1/users/suggestions', authenticate, checkActive, getSuggestions);
// User search by username or display name (must precede the :id route).
app.get('/api/v1/users/search', authenticate, checkActive, searchUsers);
// Public profile lookup by id or username (front uses usernames in URLs).
app.get('/api/v1/users/:id', getPublicUser);
app.use('/api/v1/users', moderationRoutes);
app.use('/api/v1/moderation', adminModerationRoutes);

app.use((err, _req, res, _next) => {
  logger.error(err, 'unhandled error');
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.status ?? 500;
  const message = isProduction && statusCode === 500 ? 'Internal server error' : (err.message ?? 'Internal server error');
  res.status(statusCode).json({ error: message });
});

module.exports = app;
