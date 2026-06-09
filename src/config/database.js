const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('MongoDB connected');
};

module.exports = { connectDB };
