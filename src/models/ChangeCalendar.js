/**
 * Change Calendar Model
 * 
 * Change Calendar & CAB ke liye schema.
 */

import mongoose from "mongoose";

const changeCalendarSchema = new mongoose.Schema(
  {
    changeId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    
    service: String,              // "Search orchestration"
    environment: { type: String, default: "Production" },
    owner: String,                // "Search Platform"
    
    risk: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
      index: true,
    },
    
    status: {
      type: String,
      enum: ["Approved", "Review", "Scheduled", "Rejected", "Completed"],
      default: "Scheduled",
      index: true,
    },
    
    // Window
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    
    // Conflict
    hasConflict: { type: Boolean, default: false },
    conflictType: String,          // "overlap", "blackout", "none"
    conflictMessage: String,       // "Overlaps CHG-2208 shared gateway"
    
    // Detail
    conflictAnalysis: { type: String, default: "None" },
    rollbackPlan: String,          // "Feature flag to v17"
    
    description: String,
    
    // Blackout
    isBlackout: { type: Boolean, default: false },
    blackoutReason: String,
    
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

changeCalendarSchema.index({ windowStart: 1, status: 1 });

export const ChangeCalendar = mongoose.model("ChangeCalendar", changeCalendarSchema);