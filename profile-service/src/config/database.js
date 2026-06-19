module.exports = {
  mongodbUri:
    process.env.MONGODB_URI ||
    'mongodb://admin:admin123@profile-db:27017/breezy_profiles?authSource=admin',
};
