/**
 * Challenge Model
 * 
 * OTP challenges - login ke waqt generate hote hain.
 * 5 minute mein expire ho jate hain.
 */

import mongoose from "mongoose";

const challengeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    purpose: {
      type: String,
      enum: ["login", "reset"],
      required: true,
    },

    // OTP ka digest (plain code nahi)
    codeHash: {
      type: String,
      required: true,
      select: false,
    },

    // Mode: email OTP ya TOTP
    mode: {
      type: String,
      enum: ["otp", "totp"],
      default: "otp",
    },

    // Expiry (5 min)
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // Kab consume hua
    consumedAt: {
      type: Date,
      default: null,
    },

    // Attempts (max 5)
    attempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-delete expired challenges
challengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 300 });

export const Challenge = mongoose.model("Challenge", challengeSchema);