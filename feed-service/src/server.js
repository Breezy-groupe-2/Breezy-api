const app = require('./app');
const { env } = require('./config/env');

app.listen(env.port, () => {
  console.log(`Feed Service running on port ${env.port}`);
});
