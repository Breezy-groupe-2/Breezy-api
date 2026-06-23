const express = require('express');
const userRoutes = require('./routes/user/user.routes');
const moderationRoutes = require('./routes/user/user.moderation.routes');
const { internalUserSummary, me, updatePreferences } = require('./controllers/auth.controller');
const { authenticate } = require('./middlewares/authenticate');
const { checkActive } = require('./middlewares/checkActive');
const { validate, updatePreferencesSchema } = require('./middlewares/validate');

const { setupSwagger } = require('./config/swagger');

const app = express();

app.use(express.json());

// Initialize Swagger documentation before API routes
setupSwagger(app);

app.use('/api/v1/auth', userRoutes);
app.get('/internal/users/:id', internalUserSummary);
app.get('/api/v1/users/me', authenticate, checkActive, me);
app.patch(
  '/api/v1/users/me/preferences',
  authenticate,
  checkActive,
  validate(updatePreferencesSchema),
  updatePreferences
);
app.use('/api/v1/users', moderationRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

module.exports = app;
