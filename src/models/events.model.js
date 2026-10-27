/**
 * Events Models (Admin side) - Night club events vertical
 *
 * Vendor ke NightClub, NightClubEvent, NightClubEventTicket, NightClubTable,
 * NightClubTablePricing, NightClubEventTable, NightClubEventBooking collections
 * ko admin se read karta hai. Connection packages.model.js wala hi reuse hota hai.
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

/* ---------- Night Club ---------- */
const nightClubSchema = new Schema(
  {
    vendorId: oid("Vendor"),

    name: String,
    description: String,
    venueType: String, // nightclub | lounge | pub | bar | rooftop | club | other

    address: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
    latitude: Number,
    longitude: Number,

    phone: String,
    email: String,
    website: String,
    instagram: String,

    logo: String,
    coverImage: String,
    images: [String],
    videos: [String],

    totalCapacity: Number,

    musicGenres: [String],
    residentDJs: [String],
    liveDJAvailable: Boolean,
    liveBandAvailable: Boolean,
    danceFloorAvailable: Boolean,

    minimumAge: Number,
    dressCodeRequired: Boolean,
    dressCode: String,
    stagAllowed: Boolean,
    coupleEntryAvailable: Boolean,

    operatingDays: [String],
    openingTime: String,
    closingTime: String,
    lastEntryTime: String,

    alcoholAvailable: Boolean,
    parkingAvailable: Boolean,
    valetAvailable: Boolean,
    vipSectionAvailable: Boolean,
    privateBoothAvailable: Boolean,
    smokingAreaAvailable: Boolean,
    wheelchairAccessible: Boolean,

    alcoholLicenseNumber: String,
    alcoholLicenseDocument: String,
    exciseLicenseNumber: String,
    exciseLicenseDocument: String,
    fireNOCNumber: String,
    fireNOCDocument: String,

    cancellationPolicy: String,
    refundPolicy: String,
    entryPolicy: String,
    prohibitedItems: [String],

    status: String, // draft | pending | approved | rejected | inactive
    isPublished: Boolean,
    rejectionReason: String,
  },
  opts("nightclubs")
);

/* ---------- Night Club Event ---------- */
const nightClubEventSchema = new Schema(
  {
    vendorId: oid("Vendor"),
    nightClubId: oid("NightClub"),

    title: String,
    slug: String,
    description: String,
    eventType: String,

    eventDate: Date,
    startTime: String,
    endTime: String,
    lastEntryTime: String,

    artistName: String,
    djName: String,
    hostName: String,
    musicGenres: [String],

    bannerImage: String,
    images: [String],
    videos: [String],

    totalCapacity: Number,
    availableCapacity: Number,

    stagEntryAvailable: Boolean,
    coupleEntryAvailable: Boolean,
    femaleEntryAvailable: Boolean,
    maleEntryAvailable: Boolean,

    stagEntryPrice: Number,
    coupleEntryPrice: Number,
    femaleEntryPrice: Number,
    maleEntryPrice: Number,

    vipAvailable: Boolean,
    vipPrice: Number,
    vipCapacity: Number,

    tableBookingAvailable: Boolean,
    boothBookingAvailable: Boolean,

    minimumAge: Number,
    dressCode: String,
    entryPolicy: String,

    bookingStartDate: Date,
    bookingEndDate: Date,

    status: String, // draft | pending | approved | rejected | cancelled | completed
    isPublished: Boolean,
    rejectionReason: String,
  },
  opts("nightclubevents")
);

/* ---------- Event Ticket ---------- */
const nightClubEventTicketSchema = new Schema(
  {
    vendorId: oid("Vendor"),
    nightClubId: oid("NightClub"),
    eventId: oid("NightClubEvent"),

    name: String,
    ticketType: String, // stag | couple | female | male | vip | table | booth | other
    description: String,

    price: Number,
    currency: String,

    totalQuantity: Number,
    soldQuantity: Number,
    availableQuantity: Number,

    personsPerTicket: Number,
    minimumAge: Number,

    saleStartDate: Date,
    saleEndDate: Date,

    isActive: Boolean,
    isSoldOut: Boolean,
  },
  opts("nightclubeventtickets")
);

/* ---------- Night Club Table (club inventory) ---------- */
const nightClubTableSchema = new Schema(
  {
    nightClubId: oid("NightClub"),

    tableNumber: String,
    tableName: String,
    tableType: String, // regular | premium | vip | private | booth | sofa

    capacity: Number,
    minimumPersons: Number,
    maximumPersons: Number,

    floor: String,
    section: String,
    position: String,

    nearDanceFloor: Boolean,
    nearStage: Boolean,
    privateArea: Boolean,
    smokingAllowed: Boolean,

    isActive: Boolean,
    isBookable: Boolean,

    description: String,
    image: String,
  },
  opts("nightclubtables")
);

/* ---------- Table Pricing (event wise) ---------- */
const nightClubTablePricingSchema = new Schema(
  {
    vendorId: oid("Vendor"),
    nightClubId: oid("NightClub"),
    eventId: oid("NightClubEvent"),
    tableId: oid("NightClubTable"),

    price: Number,
    minimumSpend: Number,
    currency: String,

    minimumPersons: Number,
    maximumPersons: Number,

    totalQuantity: Number,
    availableQuantity: Number,
    bookedQuantity: Number,

    isActive: Boolean,
    isBookable: Boolean,
    isSoldOut: Boolean,
  },
  opts("nightclubtablepricings")
);

/* ---------- Event Table (legacy / per-event table state) ---------- */
const nightClubEventTableSchema = new Schema(
  {
    nightClubId: oid("NightClub"),
    eventId: oid("NightClubEvent"),
    tableId: oid("NightClubTable"),

    tableNumber: String,
    tableType: String,
    capacity: Number,

    price: Number,
    currency: String,

    status: String, // available | reserved | booked | blocked | maintenance
    isAvailable: Boolean,

    bookingId: oid("NightClubEventBooking"),
    reservedUntil: Date,
    bookedAt: Date,

    minimumPersons: Number,
    maximumPersons: Number,
    complimentaryDrinks: Number,
    complimentaryFood: String,
    description: String,
  },
  opts("nightclubeventtables")
);

/* ---------- Event Booking ---------- */
const nightClubEventBookingSchema = new Schema(
  {
    userId: oid("User"),
    customerName: String,
    customerEmail: String,
    customerPhone: String,

    vendorId: oid("Vendor"),
    nightClubId: oid("NightClub"),
    eventId: oid("NightClubEvent"),

    ticketId: oid("NightClubEventTicket"),
    ticketName: String,
    ticketType: String,
    quantity: Number,
    personsPerTicket: Number,
    totalPersons: Number,

    pricePerTicket: Number,
    totalAmount: Number,
    currency: String,

    bookingId: String,
    bookingStatus: String, // pending | confirmed | cancelled | completed | refunded

    paymentStatus: String, // pending | paid | failed | refunded
    paymentMethod: String,
    paymentId: String,
    razorpayOrderId: String,
    razorpaySignature: String,
    paymentExpiresAt: Date,
    paidAt: Date,

    confirmedAt: Date,

    qrCode: String,
    qrGeneratedAt: Date,
    entryStatus: String, // not_checked | checked_in | rejected
    checkedInAt: Date,

    cancelledAt: Date,
    cancellationReason: String,
  },
  opts("nightclubeventbookings")
);

/* ---------- Register (OverwriteModelError se bachne ke liye) ---------- */
const reg = (name, schema) => conn.models[name] || conn.model(name, schema);

export const NightClub = reg("NightClub", nightClubSchema);
export const NightClubEvent = reg("NightClubEvent", nightClubEventSchema);
export const NightClubEventTicket = reg("NightClubEventTicket", nightClubEventTicketSchema);
export const NightClubTable = reg("NightClubTable", nightClubTableSchema);
export const NightClubTablePricing = reg("NightClubTablePricing", nightClubTablePricingSchema);
export const NightClubEventTable = reg("NightClubEventTable", nightClubEventTableSchema);
export const NightClubEventBooking = reg("NightClubEventBooking", nightClubEventBookingSchema);

export const CLUB_STATUSES = ["draft", "pending", "approved", "rejected", "inactive"];
export const EVENT_STATUSES = ["draft", "pending", "approved", "rejected", "cancelled", "completed"];
export const EVENT_BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed", "refunded"];