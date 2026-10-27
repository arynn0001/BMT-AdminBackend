/**
 * Live Incident Model
 * 
 * Incident Command page ke liye schema.
 * Admin panel se declare incident add ho sakta hai.
 */

import mongoose from "mongoose";

const liveIncidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    
    severity: {
      type: String,
      enum: ["P0", "P1", "P2", "P3"],
      default: "P2",
      index: true,
    },
    
    severityLabel: { type: String, default: "Critical" }, // Critical / High / Medium / Low
    
    status: {
      type: String,
      enum: ["Active", "Mitigating", "Monitoring", "Resolved"],
      default: "Active",
      index: true,
    },
    
    // Category (filter ke liye)
    category: {
      type: String,
      enum: [
        "Traveller safety",
        "Travel disruption",
        "Supplier outage",
        "Platform",
        "Other",
      ],
      default: "Other",
      index: true,
    },
    
    // Path (Cab trip operations · India)
    domain: String,        // "Cab trip operations"
    region: String,        // "India" / "India + UAE" / "Global"
    
    // Impact
    impact: { type: String },      // "1 traveller · driver location live"
    impactedBookings: { type: Number, default: 0 },
    
    // Incident Commander
    ic: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      email: String,
    },
    
    // Timeline
    declaredAt: { type: Date, default: Date.now },
    resolvedAt: Date,
    mttaSeconds: { type: Number, default: 0 }, // Mean time to acknowledge
    
    // Meta
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

liveIncidentSchema.index({ status: 1, severity: 1, createdAt: -1 });

export const LiveIncident = mongoose.model("LiveIncident", liveIncidentSchema);