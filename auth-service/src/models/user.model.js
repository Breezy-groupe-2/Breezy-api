const mongoose = require('mongoose');
const { defaultThemePreferences } = require('../config/theme-preferences');

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
    displayName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    bio: {
      type: String,
      default: '',
      maxlength: 160,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    bannerUrl: {
      type: String,
      default: '',
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
    preferences: {
      theme: {
        mode: {
          type: String,
          enum: ['light', 'dark'],
          default: defaultThemePreferences.mode,
        },
        accentColor: {
          type: String,
          match: /^#[0-9A-Fa-f]{6}$/,
          default: defaultThemePreferences.accentColor,
        },
        _id: false,
      },
      _id: false,
    },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
