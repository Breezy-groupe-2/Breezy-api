// Post Service - to be implemented
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Placeholder endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Post Service is running' });
});

app.listen(PORT, () => {
  console.log(`📝 Post Service running on port ${PORT}`);
});
