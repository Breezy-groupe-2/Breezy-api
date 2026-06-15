const mongoose = require('mongoose');
const app = require('./app');
const { mongodbUri } = require('./config/database');

const PORT = process.env.PORT || 3006;

mongoose
  .connect(mongodbUri)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Follow Service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Follow Service failed to start', err);
    process.exit(1);
  });
