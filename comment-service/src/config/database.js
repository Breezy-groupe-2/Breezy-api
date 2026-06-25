const mongoose = require('mongoose');
const { env } = require('./env');

const connectDB = async () => {
  await mongoose.connect(env.mongodbUri);
  console.log('MongoDB connected (comment-service)');
};

module.exports = { connectDB };
