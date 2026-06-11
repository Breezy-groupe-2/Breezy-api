const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/breezy_comments';
  await mongoose.connect(uri);
  console.log('MongoDB connected (comment-service)');
};

module.exports = { connectDB };
