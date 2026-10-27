/**
 * Audit Model
 * 
 * Har important action log hoti hai:
 * - Login/logout
 * - User create/update/delete
 * - Vendor approve/reject
 * - Permission changes
 */

import mongoose from "mongoose";

const auditSchema = new mongoose.Schema(
  {
    actorId: {
      type: String,
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      index: true,
      maxlength: 100,
    },

    recordId: {
      type: String,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ip: {
      type: String,
      maxlength: 45,
    },

    userAgent: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ actorId: 1, createdAt: -1 });

export const Audit = mongoose.model("Audit", auditSchema);