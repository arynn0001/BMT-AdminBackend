/**
 * User Model
 * 
 * Admin panel ke users - staff, admins, managers.
 * Login email + password se hota hai, phir OTP verify.
 */

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Basic info
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },

    // Password (hashed)
    passwordHash: {
      type: String,
      required: true,
      select: false, // By default query mein nahi aayega
    },

    // Roles (references)
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],

    // Scopes (permissions scope)
    scopes: {
      type: Map,
      of: [String],
      default: {},
    },

    // Account status
    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Login security
    failedLogins: {
      type: Number,
      default: 0,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    // 2FA
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    totpSecret: {
      type: String,
      select: false,
    },

    lastTotpStep: {
      type: Number,
      default: 0,
    },

    pendingTotp: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt automatic
  }
);

// Indexes
userSchema.index({ email: 1, active: 1 });

// Methods
userSchema.methods.toSafeJSON = function () {
  return {
    id: String(this._id),
    email: this.email,
    name: this.name,
    phone: this.phone,
    roles: this.roles,
    scopes: this.scopes,
    active: this.active,
    twoFactorEnabled: this.twoFactorEnabled,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model("User", userSchema);