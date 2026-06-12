// Feed Service database configuration
module.exports = {
  mongodbUri:
    process.env.MONGODB_URI ||
    'mongodb://admin:admin123@feed-db:27017/breezy_feeds?authSource=admin',
};
