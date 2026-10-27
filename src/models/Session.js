/**
 * Session Model
 * 
 * JWT tokens yaha save hote hain.
 * Logout karne pe revoke kar sakte hain.
 * 30 days tak valid rahenge.
 */

import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Token ka hash (plain token nahi)
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Expiry
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // Last activity
    lastSeen: {
      type: Date,
      default: Date.now,
    },

    // Device info
    device: {
      type: String,
      maxlength: 240,
    },

    ip: {
      type: String,
      maxlength: 45,
    },

    // Revoke karne ke liye
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
sessionSchema.index({ userId: 1, revokedAt: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired

export const Session = mongoose.model("Session", sessionSchema);