const express = require('express');
const userRoutes = require('./routes/user/user.routes');
const moderationRoutes = require('./routes/user/user.moderation.routes');
const { me } = require('./controllers/auth.controller');
const { authenticate } = require('./middlewares/authenticate');
const { checkActive } = require('./middlewares/checkActive');

const { setupSwagger } = require('./config/swagger');

const app = express();

app.use(express.json());

// Initialize Swagger documentation before API routes
setupSwagger(app);

app.use('/api/v1/auth', userRoutes);
app.get('/api/v1/users/me', authenticate, checkActive, me);
app.use('/api/v1/users', moderationRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

module.exports = app;
