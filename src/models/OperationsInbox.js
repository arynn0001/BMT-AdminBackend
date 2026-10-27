/**
 * Operations Inbox Model
 * 
 * Cross-module requests tracking.
 */

import mongoose from "mongoose";

const operationsInboxSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true },
    title: { type: String, required: true },       // "Request"
    description: String,
    
    // Owner (kaun request kar raha hai)
    owner: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      email: String,
    },
    
    reference: String,                             // Related ID (BMT-0001, TSK-8421)
    referenceType: String,                         // "booking", "vendor", "task"
    
    module: {
      type: String,
      enum: ["Executive", "Approvals", "Finance", "Vendors", "Bookings", "Customers", "Other"],
      default: "Executive",
      index: true,
    },
    
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    
    priority: {
      type: String,
      enum: ["urgent", "high", "normal", "low"],
      default: "normal",
    },
    
    decidedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
    },
    decidedAt: Date,
    decisionReason: String,
    
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

operationsInboxSchema.index({ status: 1, createdAt: -1 });

export const OperationsInbox = mongoose.model("OperationsInbox", operationsInboxSchema);