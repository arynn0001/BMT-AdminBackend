/**
 * Shift Handover Model
 * 
 * Shift Handovers page ke liye schema.
 */

import mongoose from "mongoose";

/* =========================================================
   HANDOVER SCHEMA
   ========================================================= */

const shiftHandoverSchema = new mongoose.Schema(
  {
    handoverId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    
    // Status
    status: {
      type: String,
      enum: ["Pending acceptance", "Accepted", "Rejected", "Completed"],
      default: "Pending acceptance",
      index: true,
    },
    
    // Operational summary
    operationalSummary: String,
    
    // Team info
    outgoing: String,        // "Morning Ground Ops"
    incoming: String,        // "Rohan Verma"
    outgoingUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    incomingUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    // Risks
    risks: [
      {
        title: String,           // "PNQ–GOA delay 48 min"
        severity: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
          default: "medium",
        },
      },
    ],
    
    // Acceptance checklist
    checklist: [
      {
        item: String,            // "Critical incidents reviewed"
        checked: { type: Boolean, default: false },
      },
    ],
    
    // Progress
    progress: { type: Number, default: 0 },  // 0-100
    
    // Timeline
    createdAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

shiftHandoverSchema.index({ status: 1, createdAt: -1 });

export const ShiftHandover = mongoose.model("ShiftHandover", shiftHandoverSchema);