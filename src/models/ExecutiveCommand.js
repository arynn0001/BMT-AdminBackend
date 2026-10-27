/**
 * Executive Command Model
 * 
 * Executive Command dashboard ke liye saare schemas:
 * - Customer (active travellers)
 * - Vendor (reference)
 * - Booking (GBV, commerce)
 * - ServiceHealth (service health table)
 * - CommandAction (command now section)
 */

import mongoose from "mongoose";

/* =========================================================
   CUSTOMER
   ========================================================= */

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true, default: "India" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Customer = mongoose.model("Customer", customerSchema);


/* =========================================================
   VENDOR
   ========================================================= */

const vendorSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    vertical: String,
    businessName: String,
    city: String,
    state: String,
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    isApproved: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, strict: false }
);

export const Vendor =
  mongoose.models.Vendor || mongoose.model("Vendor", vendorSchema);


/* =========================================================
   BOOKING
   ========================================================= */

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, unique: true, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: String,
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    vertical: String,
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    travelDate: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Booking = mongoose.model("Booking", bookingSchema);


/* =========================================================
   SERVICE HEALTH
   ========================================================= */

const serviceHealthSchema = new mongoose.Schema(
  {
    serviceName: { type: String, required: true },
    category: String,
    status: {
      type: String,
      enum: ["Healthy", "Warning", "Degraded", "Down"],
      default: "Healthy",
    },
    latency: { type: Number, default: 0 },
    traffic: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    saturation: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ServiceHealth = mongoose.model("ServiceHealth", serviceHealthSchema);


/* =========================================================
   COMMAND ACTION
   ========================================================= */

const commandActionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    priority: {
      type: String,
      enum: ["P0", "P1", "P2", "CAB", "APR"],
      default: "P2",
    },
    category: String,
    timeAgo: String,
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const CommandAction = mongoose.model("CommandAction", commandActionSchema);