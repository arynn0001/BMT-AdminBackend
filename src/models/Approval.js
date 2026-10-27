/**
 * Approval Center Model
 */

import mongoose from "mongoose";

const approvalSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    
    category: {
      type: String,
      enum: ["Vendor", "Finance", "Access", "Content", "Production"],
      default: "Vendor",
      index: true,
    },
    
    description: String,
    
    exposure: { type: Number, default: 0 },  // amount
    currency: { type: String, default: "INR" },
    
    maker: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      email: String,
    },
    
    checker: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      email: String,
    },
    
    slaMinutes: { type: Number, default: 0 },
    
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "escalated"],
      default: "pending",
      index: true,
    },
    
    priority: {
      type: String,
      enum: ["urgent", "high", "normal", "low"],
      default: "normal",
    },
    
    decidedAt: Date,
    decisionReason: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

approvalSchema.index({ status: 1, createdAt: -1 });

export const Approval = mongoose.model("Approval", approvalSchema);