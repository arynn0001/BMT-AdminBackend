/**
 * Postmortem Model
 * 
 * Postmortems & Prevention page ke liye schema.
 */

import mongoose from "mongoose";

const postmortemSchema = new mongoose.Schema(
  {
    postmortemId: { type: String, required: true, unique: true },  // "PM-184"
    incidentId: { type: String, required: true },                  // "INC-4382"
    title: { type: String, required: true },
    
    owner: String,              // "Ground Transport SRE"
    ownerEmail: String,
    
    dueDate: { type: Date, required: true },
    
    status: {
      type: String,
      enum: ["Draft", "Review", "Approved", "Closed"],
      default: "Draft",
      index: true,
    },
    
    // Review content
    impact: String,             // "18 crew devices used offline manifests for 24 minutes."
    detection: String,          // "Crew offline alert after 4 minutes."
    cause: String,              // "Expired edge token combined with retry storm."
    lessons: String,            // "Token expiry must be validated before route dispatch."
    
    // Preventative actions
    actions: [
      {
        text: { type: String, required: true },
        owner: String,
        dueDate: Date,
        done: { type: Boolean, default: false },
      },
    ],
    
    // Meta
    approvedAt: Date,
    approvedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

postmortemSchema.index({ status: 1, dueDate: 1 });

export const Postmortem = mongoose.model("Postmortem", postmortemSchema);