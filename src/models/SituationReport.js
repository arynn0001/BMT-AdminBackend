/**
 * Situation Report Model
 * 
 * Situation Reports page ke liye schema.
 */

import mongoose from "mongoose";

const situationReportSchema = new mongoose.Schema(
  {
    reportId: { type: String, required: true, unique: true },
    name: { type: String, required: true },  // "Daily command briefing"
    
    // Included sections
    sections: {
      type: [String],
      default: [
        "Executive summary",
        "Commerce",
        "Traveller operations",
        "Supply",
        "Money",
        "Customer care",
        "Reliability",
        "Approvals",
        "Incidents",
        "Changes",
        "Risks",
      ],
    },
    
    // Generated report data
    scope: String,                 // "Executive summary · Commerce · Supply..."
    content: String,               // The actual report text
    
    // Meta
    owner: String,
    ownerEmail: String,
    generatedAt: { type: Date, default: Date.now },
    
    // Schedule
    isScheduled: { type: Boolean, default: false },
    scheduleFrequency: {
      type: String,
      enum: ["Run once", "Daily", "Weekly", "Monthly"],
      default: "Run once",
    },
    nextRunAt: Date,
    outputFormat: {
      type: String,
      enum: ["CSV", "PDF", "TXT"],
      default: "TXT",
    },
    
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

situationReportSchema.index({ createdAt: -1 });

export const SituationReport = mongoose.model("SituationReport", situationReportSchema);