const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
    bio: {
      type: String,
      maxlength: 160,
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
);

module.exports = mongoose.models.Profile || mongoose.model('Profile', profileSchema);
