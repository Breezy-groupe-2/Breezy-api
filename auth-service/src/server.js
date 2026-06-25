const app = require('./app');
const { connectDB } = require('./config/database');
const { env } = require('./config/env');

connectDB().then(() => {
  app.listen(env.port, () => console.log(`Server running on port ${env.port}`));
});
