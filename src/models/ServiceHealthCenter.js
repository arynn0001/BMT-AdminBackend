/**
 * Service Health Center Model
 * 
 * Service Health page ke liye detailed schema.
 */

import mongoose from "mongoose";

const serviceHealthCenterSchema = new mongoose.Schema(
  {
    serviceId: { type: String, required: true, unique: true },
    serviceName: { type: String, required: true },
    
    // Category path (Discovery · Search Platform)
    category: String,           // "Discovery"
    platform: String,           // "Search Platform"
    
    status: {
      type: String,
      enum: ["Healthy", "Warning", "Degraded", "Down"],
      default: "Healthy",
      index: true,
    },
    
    // 4 Golden Signals
    latency: { type: Number, default: 0 },      // ms
    traffic: { type: Number, default: 0 },      // rpm
    errors: { type: Number, default: 0 },       // percentage
    saturation: { type: Number, default: 0 },   // percentage
    
    // Metadata
    market: { type: String, default: "Production" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

serviceHealthCenterSchema.index({ status: 1, category: 1 });

export const ServiceHealthCenter = mongoose.model(
  "ServiceHealthCenter",
  serviceHealthCenterSchema
);