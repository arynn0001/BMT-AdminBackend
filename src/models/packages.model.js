/**
 * Packages Models (Admin side)
 *
 * Vendor panel ke HolidayPackage / HolidayBooking collections ko
 * admin se read karta hai. Agar vendor ka DB alag hai to .env me
 * VENDOR_MONGO_URI set kar, warna admin ka default connection use hoga.
 */
import mongoose from "mongoose";

const vendorUri = process.env.VENDOR_MONGO_URI;
const conn = vendorUri ? mongoose.createConnection(vendorUri) : mongoose.connection;

/* ---------- Vendor (minimal, populate ke liye) ---------- */
const vendorSchema = new mongoose.Schema({}, { strict: false, collection: "vendors" });

/* ---------- Holiday Package ---------- */
const itinerarySchema = new mongoose.Schema({
  day: Number,
  title: String,
  description: String,
  meals: [String],
  sightseeing: [String],
});

const holidayPackageSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },

    title: { type: String, required: true },
    destination: { type: String, required: true },
    country: { type: String, default: "India" },
    duration: { type: String, required: true },
    packageType: { type: String, enum: ["Domestic", "International"], default: "Domestic" },
    category: { type: String, enum: ["Budget", "Premium", "Luxury"], default: "Budget" },
    overview: String,

    pricing: {
      perPerson: Number,
      discountPrice: Number,
      childPrice: Number,
      extraAdultPrice: Number,
      singleOccupancyPrice: Number,
      currency: { type: String, default: "INR" },
      taxesIncluded: { type: Boolean, default: true },
    },

    itinerary: [itinerarySchema],
    inclusions: [String],
    exclusions: [String],

    bannerImage: String,
    galleryImages: [String],

    validFrom: Date,
    validTill: Date,

    status: { type: String, enum: ["active", "inactive", "blocked"], default: "inactive" },
  },
  { timestamps: true, collection: "holidaypackages" }
);

holidayPackageSchema.index({ vendor: 1, status: 1 });
holidayPackageSchema.index({ title: "text", destination: "text" });

/* ---------- Holiday Booking ---------- */
const holidayBookingSchema = new mongoose.Schema(
  {
    holiday: { type: mongoose.Schema.Types.ObjectId, ref: "HolidayPackage", required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },

    userName: String,
    userEmail: String,
    userPhone: String,

    travellers: { adults: Number, children: Number },
    travelDate: Date,

    pricePerPerson: Number,
    totalAmount: Number,

    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
  },
  { timestamps: true, collection: "holidaybookings" }
);

holidayBookingSchema.index({ holiday: 1, status: 1 });
holidayBookingSchema.index({ travelDate: 1 });

/* ---------- Register (OverwriteModelError se bachne ke liye) ---------- */
export const Vendor = conn.models.Vendor || conn.model("Vendor", vendorSchema);
export const HolidayPackage =
  conn.models.HolidayPackage || conn.model("HolidayPackage", holidayPackageSchema);
export const HolidayBooking =
  conn.models.HolidayBooking || conn.model("HolidayBooking", holidayBookingSchema);

export const PACKAGE_STATUSES = ["active", "inactive", "blocked"];
export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled"];