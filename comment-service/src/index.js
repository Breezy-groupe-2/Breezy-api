// Comment Service - to be implemented
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

// Placeholder endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Comment Service is running' });
});

app.listen(PORT, () => {
  console.log(`💬 Comment Service running on port ${PORT}`);
});
