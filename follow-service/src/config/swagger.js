const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Breezy Follow Service',
      version: '1.0.0',
      description: 'Followers and Following connections management endpoints for Breezy.',
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'API Gateway',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/**/*.js', './src/controllers/**/*.js', './src/app.js'],
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.get('/api/v1/follow/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  app.use('/api/v1/follow/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = { setupSwagger, swaggerSpec };
