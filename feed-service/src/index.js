const express = require('express');
const { env } = require('./config/env');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Feed Service is running' });
});

app.listen(env.port, () => {
  console.log(`Feed Service running on port ${env.port}`);
});
