module.exports = {
  mongodbUri:
    process.env.MONGODB_URI ||
    'mongodb://admin:admin123@auth-db:27017/breezy_auth?authSource=admin',
};
