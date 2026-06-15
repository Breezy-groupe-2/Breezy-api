const mongoose = require('mongoose');

// Temporarily shared with follow-service until feed ownership moves off User.following.
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    moderationStatus: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active',
    },
    bannedUntil: {
      type: Date,
      default: null,
    },
    moderationHistory: [
      {
        action: {
          type: String,
          enum: ['suspend', 'ban', 'unban'],
          required: true,
        },
        reason: {
          type: String,
          required: true,
        },
        durationHours: {
          type: Number,
        },
        bannedUntil: {
          type: Date,
        },
        moderatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
