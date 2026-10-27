/**
 * Role Model
 * 
 * Permissions aur access control ke liye.
 * Har user ke paas multiple roles ho sakte hain.
 */

import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Permissions list - e.g. ["users:read", "users:write", "vendors:read"]
    permissions: {
      type: [String],
      default: [],
    },

    // Scopes - kaunse department/market/country ka access
    scopes: {
      department: { type: [String], default: ["*"] },
      market: { type: [String], default: ["*"] },
      country: { type: [String], default: ["*"] },
      vertical: { type: [String], default: ["*"] },
      branch: { type: [String], default: ["*"] },
    },

    // Sirf apne records dekh sakta hai?
    ownRecordsOnly: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
roleSchema.index({ name: 1 });

export const Role = mongoose.model("Role", roleSchema);