require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');
const { mongodbUri } = require('./config/database');

const PORT = process.env.PORT || 3007;

mongoose
  .connect(mongodbUri)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Profile Service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Profile Service failed to start', err);
    process.exit(1);
  });
