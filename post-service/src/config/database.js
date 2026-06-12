// Post Service database configuration
module.exports = {
  mongodbUri:
    process.env.MONGODB_URI ||
    'mongodb://admin:admin123@post-db:27017/breezy_posts?authSource=admin',
};
