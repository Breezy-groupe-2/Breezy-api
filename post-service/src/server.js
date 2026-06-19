const mongoose = require('mongoose');
const app = require('./app');
const { env } = require('./config/env');

mongoose
  .connect(env.mongodbUri)
  .then(() => {
    app.listen(env.port, () => {
      console.log(`Post Service running on port ${env.port}`);
    });
  })
  .catch((err) => {
    console.error('Post Service failed to start', err);
    process.exit(1);
  });
