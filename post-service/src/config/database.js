const mongoose = require('mongoose');

const connectDB = async () => {
  const uri =
    process.env.MONGODB_URI ||
    'mongodb://admin:admin123@post-db:27017/breezy_posts?authSource=admin';
  await mongoose.connect(uri);
  console.log('MongoDB connected (post-service)');
};

module.exports = { connectDB };
