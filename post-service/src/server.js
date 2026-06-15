require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');
const { mongodbUri } = require('./config/database');

const PORT = process.env.PORT || 3002;

mongoose
  .connect(mongodbUri)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Post Service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Post Service failed to start', err);
    process.exit(1);
  });
