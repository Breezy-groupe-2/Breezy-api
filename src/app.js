const express = require('express');
const userRoutes = require('./routes/user/user.routes');
const postRoutes = require('./routes/post/post.routes');
const { me } = require('./controllers/auth.controller');
const { authenticate } = require('./middlewares/authenticate');

const app = express();

app.use(express.json());
app.use('/api/v1/auth', userRoutes);
app.get('/api/v1/users/me', authenticate, me);
app.use('/api/v1/posts', postRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

module.exports = app;
