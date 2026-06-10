// Comment Service database configuration
module.exports = {
  mongodbUri: process.env.MONGODB_URI || 'mongodb://admin:admin123@comment-db:27017/breezy_comments?authSource=admin',
};
