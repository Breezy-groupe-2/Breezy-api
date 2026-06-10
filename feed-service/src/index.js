// Feed Service - to be implemented
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

// Placeholder endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Feed Service is running' });
});

app.listen(PORT, () => {
  console.log(`📰 Feed Service running on port ${PORT}`);
});
