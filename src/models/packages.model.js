/**
 * Packages Models (Admin side)
 *
 * Vendor ke `Tour` model (collection: "tours") ko admin se read/approve karta hai.
 * Agar vendor ka DB alag hai to .env me VENDOR_MONGO_URI set kar,
 * warna admin ka default connection use hoga (same DB).
 */
import mongoose from "mongoose";

const vendorUri = process.env.VENDOR_MONGO_URI;
const conn = vendorUri ? mongoose.createConnection(vendorUri) : mongoose.connection;

/* ---------- Vendor (minimal, populate ke liye) ---------- */
const vendorSchema = new mongoose.Schema({}, { strict: false, collection: "vendors" });

/* ---------- Tour (vendor wale schema jaisa hi) ---------- */
const itinerarySchema = new mongoose.Schema(
  {
    day: Number,
    title: String,
    description: String,
  },
  { _id: false }
);

export const TOUR_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];
export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled"];

const tourSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },

    title: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, lowercase: true },
    shortDescription: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },

    location: {
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true, default: "India" },
      address: { type: String, trim: true },
      latitude: Number,
      longitude: Number,
    },

    duration: {
      value: Number,
      unit: { type: String, enum: ["hours", "days"] },
    },

    images: { type: [String], default: [] },
    inclusions: { type: [String], default: [] },
    exclusions: { type: [String], default: [] },
    itinerary: { type: [itinerarySchema], default: [] },

    pricing: {
      adult: { type: Number, default: 0 },
      child: { type: Number, default: 0 },
      infant: { type: Number, default: 0 },
    },

    maxGuests: Number,
    meetingPoint: { type: String, trim: true },
    cancellationPolicy: { type: String, trim: true },
    termsAndConditions: { type: String, trim: true },

    status: { type: String, enum: TOUR_STATUSES, default: "DRAFT" },
    isActive: { type: Boolean, default: true },

    // Admin side extra (reject karte waqt reason)
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true, collection: "tours" }
);

tourSchema.index({ status: 1, createdAt: -1 });
tourSchema.index({ title: "text", "location.city": "text" });

/* ---------- Tour Booking ----------
 * NOTE: Vendor ka booking model abhi share nahi hua. Ye flexible hai (strict:false),
 * collection name "tourbookings" hai. Apne vendor booking model ke hisaab se
 * collection / field names yahan badal lena.
 */
const tourBookingSchema = new mongoose.Schema(
  {
    tour: { type: mongoose.Schema.Types.ObjectId, ref: "Tour" },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },

    userName: String,
    userEmail: String,
    userPhone: String,

    travelDate: Date,
    totalAmount: Number,

    status: { type: String, enum: BOOKING_STATUSES, default: "pending" },
  },
  { timestamps: true, strict: false, collection: "tourbookings" }
);

tourBookingSchema.index({ tour: 1, status: 1 });
tourBookingSchema.index({ travelDate: 1 });

/* ---------- Register (OverwriteModelError se bachne ke liye) ---------- */
export const Vendor = conn.models.Vendor || conn.model("Vendor", vendorSchema);
export const Tour = conn.models.Tour || conn.model("Tour", tourSchema);
export const TourBooking =
  conn.models.TourBooking || conn.model("TourBooking", tourBookingSchema);

// Backward-compatible aliases
export const HolidayPackage = Tour;
export const HolidayBooking = TourBooking;
export const PACKAGE_STATUSES = TOUR_STATUSES;