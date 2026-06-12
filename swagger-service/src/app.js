const express = require('express');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(express.json());

// Resolve path to openapi.json
let swaggerDocument;
try {
  let swaggerPath = path.join(__dirname, '..', '..', 'swagger', 'openapi.json');
  if (!fs.existsSync(swaggerPath)) {
    swaggerPath = path.join(__dirname, '..', '..', 'Swagger', 'openapi.json');
  }
  if (!fs.existsSync(swaggerPath)) {
    swaggerPath = path.join(__dirname, '..', 'swagger', 'openapi.json');
  }
  if (!fs.existsSync(swaggerPath)) {
    swaggerPath = path.join(__dirname, '..', 'Swagger', 'openapi.json');
  }
  if (!fs.existsSync(swaggerPath)) {
    swaggerPath = path.join(process.cwd(), 'swagger', 'openapi.json');
  }
  if (!fs.existsSync(swaggerPath)) {
    swaggerPath = path.join(process.cwd(), 'Swagger', 'openapi.json');
  }

  if (fs.existsSync(swaggerPath)) {
    swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
    console.log(`Loaded swagger spec from ${swaggerPath}`);
  } else {
    console.error('Swagger spec file (openapi.json) not found');
  }
} catch (err) {
  console.error('Error loading Swagger document:', err);
}

if (swaggerDocument) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
  app.get('/api-docs', (req, res) => {
    res.status(500).json({ error: 'Swagger configuration is missing or invalid' });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Swagger Service is running' });
});

// Redirect from root to api-docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

module.exports = app;
