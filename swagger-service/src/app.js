const express = require('express');
const swaggerUi = require('swagger-ui-express');

const app = express();

app.use(express.json());

const services = [
  { path: '/api/v1/auth/swagger.json', target: 'http://auth-service:3001/api/v1/auth/swagger.json', name: 'Authentication & Moderation' },
  { path: '/api/v1/posts/swagger.json', target: 'http://post-service:3002/api/v1/posts/swagger.json', name: 'Posts & Likes' },
  { path: '/api/v1/comments/swagger.json', target: 'http://comment-service:3003/api/v1/comments/swagger.json', name: 'Comments & Replies' },
  { path: '/api/v1/follow/swagger.json', target: 'http://follow-service:3006/api/v1/follow/swagger.json', name: 'Follows' },
  { path: '/api/v1/feed/swagger.json', target: 'http://feed-service:3004/api/v1/feed/swagger.json', name: 'Timeline Feed' },
  { path: '/api/v1/profiles/swagger.json', target: 'http://profile-service:3007/api/v1/profiles/swagger.json', name: 'User Profiles' }
];

// Define proxy routes in swagger-service itself to support direct port 3005 access
services.forEach(service => {
  app.get(service.path, async (req, res) => {
    try {
      const response = await fetch(service.target);
      if (!response.ok) {
        throw new Error(`Failed to fetch from service: ${response.statusText}`);
      }
      const data = await response.json();
      res.setHeader('Content-Type', 'application/json');
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: `Bad Gateway: ${err.message}`, service: service.name });
    }
  });
});

const options = {
  explorer: true,
  swaggerOptions: {
    urls: services.map(s => ({ url: s.path, name: s.name }))
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, options));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Swagger Service is running' });
});

// Redirect from root to api-docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

module.exports = app;
