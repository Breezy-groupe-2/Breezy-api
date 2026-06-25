const app = require('./app');
const { connectDB } = require('./config/database');
const { env } = require('./config/env');

connectDB()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`Comment Service running on port ${env.port}`);
    });
  })
  .catch((err) => {
    console.error('Comment Service failed to start', err);
    process.exit(1);
  });
