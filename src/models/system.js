/**
 * System Models
 * 
 * User, Role, Session, Audit - sab ek file mein.
 */

import mongoose from "mongoose";

/* =========================================================
   USER
   ========================================================= */

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      sparse: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],
    scopes: {
      type: Map,
      of: [String],
      default: {},
    },
    active: {
      type: Boolean,
      default: true,
    },
    failedLogins: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);


/* =========================================================
   ROLE
   ========================================================= */

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    permissions: {
      type: [String],
      default: [],
    },
    scopes: {
      department: { type: [String], default: ["*"] },
      market: { type: [String], default: ["*"] },
      country: { type: [String], default: ["*"] },
      vertical: { type: [String], default: ["*"] },
      branch: { type: [String], default: ["*"] },
    },
    ownRecordsOnly: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Role = mongoose.model("Role", roleSchema);


/* =========================================================
   SESSION
   ========================================================= */

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    device: {
      type: String,
      maxlength: 240,
    },
    ip: {
      type: String,
      maxlength: 45,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model("Session", sessionSchema);


/* =========================================================
   AUDIT
   ========================================================= */

const auditSchema = new mongoose.Schema(
  {
    actorId: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      maxlength: 100,
    },
    recordId: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      maxlength: 45,
    },
    userAgent: {
      type: String,
      maxlength: 500,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Audit = mongoose.model("Audit", auditSchema);
/* ================= VENDOR ================= */

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: String,
    password: String,

    businessName: String,
    ownerName: String,

    vertical: {
      type: String,
      enum: ["bus", "hotel", "cab", "flight", "train", "tour"],
      index: true,
    },
    selectedVertical: String,
    services: [String],

    city: String,
    state: String,
    country: { type: String, default: "India" },
    address: String,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
      index: true,
    },
    isApproved: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    busDetails: {
      operatorName: String,
      totalBuses: { type: Number, default: 0 },
      operatingCities: [String],
    },
    hotelDetails: { type: Object },
    cabDetails: { type: Object },

    notes: String,
    lastSyncedAt: Date,
  },
  { timestamps: true, strict: false }
);

vendorSchema.index({ vertical: 1, status: 1 });

// ✅ Safe pattern — duplicate register nahi hoga
export const Vendor =
  mongoose.models.Vendor || mongoose.model("Vendor", vendorSchema);