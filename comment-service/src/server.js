require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/database');

const PORT = process.env.PORT || 3003;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Comment Service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Comment Service failed to start', err);
    process.exit(1);
  });
