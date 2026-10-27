/**
 * Activities Models (Admin side)
 *
 * Vendor panel ke Activity / ActivitySchedule / ActivityBooking collections
 * ko admin se read karta hai. Connection packages.model.js wala hi reuse hota hai
 * (VENDOR_MONGO_URI set hai to vendor DB, warna admin ka default DB).
 *
 * autoIndex: false -> admin se vendor collections ke indexes touch nahi honge.
 */
import mongoose from "mongoose";
import { Vendor } from "./packages.model.js";

const conn = Vendor.db;
const { Schema } = mongoose;

/* ---------- User (minimal, populate ke liye) ---------- */
const userSchema = new Schema({}, { strict: false, collection: "users", autoIndex: false });

/* ---------- Activity ---------- */
const activitySchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },

    title: { type: String, required: true, trim: true },
    slug: { type: String, lowercase: true, trim: true },
    category: { type: String, required: true, trim: true },
    activityType: {
      type: String,
      enum: [
        "SIGHTSEEING",
        "ADVENTURE",
        "WATER_ACTIVITY",
        "CULTURAL",
        "ENTERTAINMENT",
        "FOOD",
        "WILDLIFE",
        "SPORTS",
        "WELLNESS",
        "OTHER",
      ],
      default: "OTHER",
    },
    shortDescription: String,
    description: { type: String, required: true },
    highlights: [String],

    location: {
      city: String,
      state: String,
      country: { type: String, default: "India" },
      address: String,
      latitude: Number,
      longitude: Number,
    },

    duration: {
      value: { type: Number, default: 0 },
      unit: { type: String, enum: ["hours", "days"], default: "hours" },
    },

    images: [String],
    thumbnail: String,

    pricing: {
      adult: { type: Number, default: 0 },
      child: { type: Number, default: 0 },
      infant: { type: Number, default: 0 },
    },
    currency: { type: String, default: "INR" },

    maxGuests: { type: Number, default: 1 },
    meetingPoint: String,
    pickupAvailable: { type: Boolean, default: false },
    pickupDetails: String,

    instantConfirmation: { type: Boolean, default: true },
    bookingCutoffHours: { type: Number, default: 2 },
    minAge: { type: Number, default: 0 },
    maxAge: Number,

    languages: [String],
    inclusions: [String],
    exclusions: [String],
    requirements: [String],

    cancellationPolicy: String,
    termsAndConditions: String,

    status: {
      type: String,
      enum: ["DRAFT", "PENDING", "APPROVED", "REJECTED"],
      default: "DRAFT",
    },
    rejectionReason: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "activities", autoIndex: false }
);

/* ---------- Activity Schedule ---------- */
const activityScheduleSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", required: true },

    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: String,

    totalSlots: { type: Number, required: true, default: 1 },
    bookedSlots: { type: Number, default: 0 },

    pricing: { adult: Number, child: Number, infant: Number },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "activityschedules", autoIndex: false }
);

/* ---------- Activity Booking ---------- */
const statusHistorySchema = new Schema(
  {
    status: String,
    by: { type: String, enum: ["USER", "VENDOR", "SYSTEM"] },
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const activityBookingSchema = new Schema(
  {
    bookingId: { type: String, required: true },

    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", required: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: "ActivitySchedule", required: true },

    guests: {
      adults: Number,
      children: { type: Number, default: 0 },
      infants: { type: Number, default: 0 },
    },
    slotsBooked: Number,

    leadTraveller: { name: String, email: String, phone: String },
    specialRequest: String,

    priceSnapshot: { adult: Number, child: Number, infant: Number },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    activitySnapshot: {
      title: String,
      thumbnail: String,
      city: String,
      meetingPoint: String,
      cancellationPolicy: String,
    },
    activityDate: Date,
    startTime: String,
    endTime: String,
    startsAt: Date,

    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED"],
      default: "PENDING",
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUND_PENDING", "REFUNDED"],
      default: "PENDING",
    },
    paymentId: String,

    cancelledBy: { type: String, enum: ["USER", "VENDOR", "SYSTEM"] },
    cancellationReason: String,
    cancelledAt: Date,
    confirmedAt: Date,
    completedAt: Date,

    statusHistory: [statusHistorySchema],
  },
  { timestamps: true, collection: "activitybookings", autoIndex: false }
);

/* ---------- Register (OverwriteModelError se bachne ke liye) ---------- */
export const User = conn.models.User || conn.model("User", userSchema);
export const Activity = conn.models.Activity || conn.model("Activity", activitySchema);
export const ActivitySchedule =
  conn.models.ActivitySchedule || conn.model("ActivitySchedule", activityScheduleSchema);
export const ActivityBooking =
  conn.models.ActivityBooking || conn.model("ActivityBooking", activityBookingSchema);

export const ACTIVITY_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];
export const ACTIVITY_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED"];