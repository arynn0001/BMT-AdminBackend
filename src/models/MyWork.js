/**
 * My Work Model
 * 
 * My Work page ke liye schemas:
 * - MyTask (operational queue)
 * - Workspace (authorized workspaces)
 * - Shift (current shift info)
 * - Completion (recent completions)
 */

import mongoose from "mongoose";

/* =========================================================
   MY TASK (Operational Queue)
   ========================================================= */

const myTaskSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    priority: {
      type: String,
      enum: ["Urgent", "High", "Normal", "Low"],
      default: "Normal",
    },
    category: String,        // "Vendor correction", "Inventory", etc.
    queue: String,           // "Executive approvals", "Critical incidents"
    slaMinutes: { type: Number, default: 0 },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedToName: String,
    status: {
      type: String,
      enum: ["open", "in_progress", "completed", "escalated"],
      default: "open",
    },
    completedAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

myTaskSchema.index({ assignedTo: 1, status: 1 });

export const MyTask = mongoose.model("MyTask", myTaskSchema);


/* =========================================================
   WORKSPACE (Authorized Workspaces)
   ========================================================= */

const workspaceSchema = new mongoose.Schema(
  {
    workspaceId: { type: String, required: true, unique: true },
    title: { type: String, required: true },  // "Executive", "Approvals"
    icon: String,
    route: String,                            // "/admin/executive"
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Workspace = mongoose.model("Workspace", workspaceSchema);


/* =========================================================
   SHIFT (Shift & Handover)
   ========================================================= */

const shiftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shiftName: { type: String, default: "Always-on privileged" },
    status: { type: String, enum: ["Active", "Ended"], default: "Active" },
    progress: { type: Number, default: 65 },  // 0-100
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Shift = mongoose.model("Shift", shiftSchema);


/* =========================================================
   COMPLETION (Recent Completions)
   ========================================================= */

const completionSchema = new mongoose.Schema(
  {
    taskId: String,
    title: { type: String, required: true },
    priority: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedByName: String,
    resolution: String,
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Completion = mongoose.model("Completion", completionSchema);