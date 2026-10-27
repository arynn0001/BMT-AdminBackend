/**
 * Darshan Models (Admin side)
 *
 * Vendor ke Darshan, DarshanType, DarshanSlot, DarshanSlotAvailability,
 * DarshanBooking collections ko admin se read karta hai.
 * Connection packages.model.js wala hi reuse hota hai.
 *
 * autoIndex: false -> admin se vendor collections ke indexes touch nahi honge.
 */
import mongoose from "mongoose";
import { Vendor } from "./packages.model.js";
import "./activities.model.js"; // User model register ho jaye (populate ke liye)

const conn = Vendor.db;
const { Schema } = mongoose;

const oid = (ref) => ({ type: Schema.Types.ObjectId, ref });
const opts = (collection) => ({ timestamps: true, collection, autoIndex: false });

/* ---------- Darshan (temple) ---------- */
const darshanSchema = new Schema(
  {
    vendorId: oid("Vendor"),

    name: String,
    slug: String,
    description: String,
    shortDescription: String,

    templeName: String,
    deityName: String,
    deityType: String,

    address: String,
    landmark: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
    latitude: Number,
    longitude: Number,

    mainImage: String,
    galleryImages: [String],

    openingTime: String,
    closingTime: String,
    morningDarshanStart: String,
    morningDarshanEnd: String,
    eveningDarshanStart: String,
    eveningDarshanEnd: String,

    operatingDays: [String],
    darshanTypes: [String],

    dailyCapacity: Number,
    basePrice: Number,
    currency: String,

    wheelchairAccessible: Boolean,
    parkingAvailable: Boolean,
    cloakRoomAvailable: Boolean,
    prasadAvailable: Boolean,

    ageRestriction: Number,
    dressCode: String,
    entryPolicy: String,
    cancellationPolicy: String,

    phone: String,
    email: String,
    website: String,

    status: String, // draft | pending | approved | rejected | inactive
    isPublished: Boolean,
    rejectionReason: String,
    isActive: Boolean,
  },
  opts("darshans")
);

/* ---------- Darshan Type ---------- */
const darshanTypeSchema = new Schema(
  {
    vendorId: oid("Vendor"),
    darshanId: oid("Darshan"),

    name: String,
    slug: String,
    description: String,
    shortDescription: String,

    type: String, // general | vip | special | sheeghra | aarti | paid | free | other
    image: String,

    dailyCapacity: Number,
    perSlotCapacity: Number,
    maxPersonsPerBooking: Number,

    adultPrice: Number,
    childPrice: Number,
    seniorCitizenPrice: Number,
    currency: String,

    minimumAge: Number,
    bookingAllowed: Boolean,
    advanceBookingDays: Number,

    status: String, // draft | active | inactive
    isPublished: Boolean,
    isActive: Boolean,
    rejectionReason: String,
  },
  opts("darshantypes")
);

/* ---------- Darshan Slot (schema vendor controller se infer kiya gaya) ---------- */
const darshanSlotSchema = new Schema(
  {
    vendorId: oid("Vendor"),
    darshanId: oid("Darshan"),
    darshanTypeId: oid("DarshanType"),

    name: String,
    startTime: String,
    endTime: String,

    capacity: Number,
    availableCapacity: Number,
    bookedCapacity: Number,
    maxPersonsPerBooking: Number,

    adultPrice: Number,
    childPrice: Number,
    seniorCitizenPrice: Number,
    currency: String,

    description: String,

    isActive: Boolean,
    isBookable: Boolean,
    isSoldOut: Boolean,
  },
  opts("darshanslots")
);

/* ---------- Slot Availability (date wise) ---------- */
const darshanSlotAvailabilitySchema = new Schema(
  {
    vendorId: oid("Vendor"),
    darshanId: oid("Darshan"),
    darshanTypeId: oid("DarshanType"),
    slotId: oid("DarshanSlot"),

    date: Date,

    totalCapacity: Number,
    availableCapacity: Number,
    bookedCapacity: Number,
    maxPersonsPerBooking: Number,

    adultPrice: Number,
    childPrice: Number,
    seniorCitizenPrice: Number,
    currency: String,

    isActive: Boolean,
    isBookable: Boolean,
    isSoldOut: Boolean,

    isBlocked: Boolean,
    blockedReason: String,

    notes: String,
  },
  opts("darshanslotavailabilities")
);

/* ---------- Darshan Booking ---------- */
const darshanBookingSchema = new Schema(
  {
    userId: oid("User"),
    customerName: String,
    customerEmail: String,
    customerPhone: String,

    vendorId: oid("Vendor"),
    darshanId: oid("Darshan"),
    darshanTypeId: oid("DarshanType"),
    slotId: oid("DarshanSlot"),
    availabilityId: oid("DarshanSlotAvailability"),

    bookingDate: Date,

    adultCount: Number,
    childCount: Number,
    seniorCitizenCount: Number,
    totalPersons: Number,

    adultPrice: Number,
    childPrice: Number,
    seniorCitizenPrice: Number,
    adultAmount: Number,
    childAmount: Number,
    seniorCitizenAmount: Number,
    totalAmount: Number,
    currency: String,

    bookingId: String,
    bookingStatus: String, // pending | confirmed | cancelled | completed | refunded

    paymentStatus: String, // pending | paid | failed | refunded
    paymentMethod: String,
    paymentId: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    qrCode: String,
    entryStatus: String, // not_checked | checked_in | rejected
    checkedInAt: Date,

    cancelledAt: Date,
    cancellationReason: String,
  },
  opts("darshanbookings")
);

/* ---------- Register (OverwriteModelError se bachne ke liye) ---------- */
const reg = (name, schema) => conn.models[name] || conn.model(name, schema);

export const Darshan = reg("Darshan", darshanSchema);
export const DarshanType = reg("DarshanType", darshanTypeSchema);
export const DarshanSlot = reg("DarshanSlot", darshanSlotSchema);
export const DarshanSlotAvailability = reg("DarshanSlotAvailability", darshanSlotAvailabilitySchema);
export const DarshanBooking = reg("DarshanBooking", darshanBookingSchema);

export const DARSHAN_STATUSES = ["draft", "pending", "approved", "rejected", "inactive"];
export const DARSHAN_BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed", "refunded"];