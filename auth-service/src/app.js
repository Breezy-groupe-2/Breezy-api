const express = require('express');
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

const { setupSwagger } = require('./config/swagger');

const app = express();

app.use(express.json());

// Initialize Swagger documentation before API routes
setupSwagger(app);

app.use('/api/v1/auth', userRoutes);
app.get('/internal/users', internalUsersByIds);
app.get('/internal/users/by-username/:username', internalUserByUsername);
app.get('/internal/users/:id', internalUserSummary);
// follow-service keeps the follow graph in sync here (service-to-service only).
app.put('/internal/users/:followerId/following/:followingId', syncFollowing);
app.delete('/internal/users/:followerId/following/:followingId', syncUnfollowing);
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
// Public profile lookup by id or username (front uses usernames in URLs).
app.get('/api/v1/users/:id', getPublicUser);
app.use('/api/v1/users', moderationRoutes);
app.use('/api/v1/moderation', adminModerationRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

module.exports = app;
