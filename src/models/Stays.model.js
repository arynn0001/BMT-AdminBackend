/**
 * Stays Model (Admin)
 *
 * Vendor aur Admin SAME MongoDB use karte hain. Isliye yahan naye data
 * nahi banaya ja raha - vendor ke collections ko hi "strict: false"
 * schema ke saath bind kiya gaya hai, taaki vendor ne jo bhi field add
 * ki ho (ya future me add kare) vo admin pe automatically fetch ho.
 *
 * Covered: Hotel, Motel, Homestay, Apartment, Villa, Palace, Resort, BnB
 *
 * IMPORTANT: collection names vendor backend ke mongoose model names se
 * derive hote hain (Hotel -> hotels, VendorApartment -> vendorapartments,
 * BnbProperty -> bnbproperties ...). Agar vendor me koi model rename ho
 * to sirf neeche COLLECTIONS me naam badalna hai.
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

/* ============================================================
   COLLECTION BINDINGS (vendor ke collections, read + admin update)
============================================================ */

const COLLECTIONS = {
  // Properties
  hotel: "hotels",
  homestay: "homestays",
  apartment: "vendorapartments",
  palace: "palaces",
  resort: "resorts",
  bnb: "bnbproperties",
  villa: "vacationhouses",
  motelOperator: "motelvendors",

  // Rooms / units
  hotelRoom: "hotelrooms",
  homestayUnit: "homestayunits",
  palaceRoomCategory: "palaceroomcategories",
  palaceRoomUnit: "palaceroomunits",
  resortRoom: "resortrooms",
  resortRoomUnit: "resortroomunits",

  // Rates
  apartmentRatePlan: "apartmentrateplans",
  palaceRatePlan: "palacerateplans",
  resortRatePlan: "resortrateplans",

  // Inventory
  hotelInventory: "hotelinventories",
  homestayInventory: "homestayinventories",
  apartmentInventory: "apartmentinventories",
  palaceInventory: "palaceinventories",
  resortInventory: "resortinventories",

  // Bookings
  hotelBooking: "hotelbookings",
  homestayBooking: "homestaybookings",
  apartmentBooking: "apartmentbookings",
  palaceBooking: "palacebookings",
  resortBooking: "resortbookings",

  // Reviews
  homestayReview: "homestayreviews",
  resortReview: "resortreviews",

  // Vendor
  vendor: "vendors",
};

function bind(modelName, collection) {
  const key = `Stays${modelName}`;
  if (mongoose.models[key]) return mongoose.models[key];

  const schema = new Schema(
    {},
    {
      strict: false, // vendor ke saare fields aane do
      collection,
      timestamps: false, // timestamps vendor ne already set kiye hain
      versionKey: false,
    }
  );

  return mongoose.model(key, schema);
}

export const StaysHotel = bind("Hotel", COLLECTIONS.hotel);
export const StaysHomestay = bind("Homestay", COLLECTIONS.homestay);
export const StaysApartment = bind("Apartment", COLLECTIONS.apartment);
export const StaysPalace = bind("Palace", COLLECTIONS.palace);
export const StaysResort = bind("Resort", COLLECTIONS.resort);
export const StaysBnb = bind("Bnb", COLLECTIONS.bnb);
export const StaysVilla = bind("Villa", COLLECTIONS.villa);
export const StaysMotelOperator = bind("MotelOperator", COLLECTIONS.motelOperator);

export const StaysHotelRoom = bind("HotelRoom", COLLECTIONS.hotelRoom);
export const StaysHomestayUnit = bind("HomestayUnit", COLLECTIONS.homestayUnit);
export const StaysPalaceRoomCategory = bind("PalaceRoomCategory", COLLECTIONS.palaceRoomCategory);
export const StaysPalaceRoomUnit = bind("PalaceRoomUnit", COLLECTIONS.palaceRoomUnit);
export const StaysResortRoom = bind("ResortRoom", COLLECTIONS.resortRoom);
export const StaysResortRoomUnit = bind("ResortRoomUnit", COLLECTIONS.resortRoomUnit);

export const StaysApartmentRatePlan = bind("ApartmentRatePlan", COLLECTIONS.apartmentRatePlan);
export const StaysPalaceRatePlan = bind("PalaceRatePlan", COLLECTIONS.palaceRatePlan);
export const StaysResortRatePlan = bind("ResortRatePlan", COLLECTIONS.resortRatePlan);

export const StaysHotelInventory = bind("HotelInventory", COLLECTIONS.hotelInventory);
export const StaysHomestayInventory = bind("HomestayInventory", COLLECTIONS.homestayInventory);
export const StaysApartmentInventory = bind("ApartmentInventory", COLLECTIONS.apartmentInventory);
export const StaysPalaceInventory = bind("PalaceInventory", COLLECTIONS.palaceInventory);
export const StaysResortInventory = bind("ResortInventory", COLLECTIONS.resortInventory);

export const StaysHotelBooking = bind("HotelBooking", COLLECTIONS.hotelBooking);
export const StaysHomestayBooking = bind("HomestayBooking", COLLECTIONS.homestayBooking);
export const StaysApartmentBooking = bind("ApartmentBooking", COLLECTIONS.apartmentBooking);
export const StaysPalaceBooking = bind("PalaceBooking", COLLECTIONS.palaceBooking);
export const StaysResortBooking = bind("ResortBooking", COLLECTIONS.resortBooking);

export const StaysHomestayReview = bind("HomestayReview", COLLECTIONS.homestayReview);
export const StaysResortReview = bind("ResortReview", COLLECTIONS.resortReview);

export const StaysVendor = bind("Vendor", COLLECTIONS.vendor);

/* ============================================================
   NORMALIZED STATUS (admin UI ke liye sabka ek hi format)
============================================================ */

export const STAY_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "INACTIVE",
  "SUSPENDED",
];

/* ============================================================
   STAY TYPE REGISTRY
   Har type ki vendor-side differences yahan define hain.

   statusCase : vendor DB me status "lower" ya "upper" case me hai
   statusKind : "enum"    -> status field hai
                "boolean" -> sirf isApproved boolean hai (BnB)
   statusEnum : vendor schema me allowed values (admin sirf inhi me likhega)
============================================================ */

const get = (obj, path, fallback = undefined) => {
  const value = path
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  return value === undefined || value === null || value === "" ? fallback : value;
};

const firstImage = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return firstImage(v[0]);
  if (typeof v === "object") return v.url || firstImage(Object.values(v)[0]);
  return "";
};

export const STAY_TYPES = {
  hotel: {
    label: "Hotel",
    model: StaysHotel,
    vendorField: "vendor",
    baseFilter: { hotelType: { $not: /motel/i } },
    statusKind: "enum",
    statusCase: "lower",
    statusEnum: ["pending", "approved", "rejected"],
    nameOf: (d) => d.hotelName,
    subtypeOf: (d) => d.hotelType,
    cityOf: (d) => d.city,
    stateOf: (d) => d.state,
    imageOf: (d) => firstImage(d.hotelImages),
    priceOf: (d) => d.pricePerNight ?? minRoomPrice(d.rooms),
    roomsOf: (d) => (Array.isArray(d.rooms) ? d.rooms.length : 0),
    featuredOf: (d) => !!d.featured,
    ratingOf: (d) => d.averageRating ?? 0,
    searchFields: ["hotelName", "city", "state", "phone", "email", "area"],
    cityField: "city",
  },

  motel: {
    label: "Motel",
    model: StaysHotel, // motel vendor ke hotel collection me hotelType=motel ke saath save hota hai
    vendorField: "vendor",
    baseFilter: { hotelType: /motel/i },
    statusKind: "enum",
    statusCase: "lower",
    statusEnum: ["pending", "approved", "rejected"],
    nameOf: (d) => d.hotelName,
    subtypeOf: (d) => d.hotelType || "motel",
    cityOf: (d) => d.city,
    stateOf: (d) => d.state,
    imageOf: (d) => firstImage(d.hotelImages),
    priceOf: (d) => d.pricePerNight ?? minRoomPrice(d.rooms),
    roomsOf: (d) => (Array.isArray(d.rooms) ? d.rooms.length : 0),
    featuredOf: (d) => !!d.featured,
    ratingOf: (d) => d.averageRating ?? 0,
    searchFields: ["hotelName", "city", "state", "phone", "email", "area"],
    cityField: "city",
  },

  homestay: {
    label: "Homestay",
    model: StaysHomestay,
    vendorField: "vendor",
    baseFilter: {},
    statusKind: "enum",
    statusCase: "upper",
    statusEnum: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
    nameOf: (d) => d.propertyName,
    subtypeOf: (d) => d.propertyType,
    cityOf: (d) => d.city,
    stateOf: (d) => d.state,
    imageOf: (d) => d.coverImage || firstImage(d.propertyImages),
    priceOf: () => null, // price HomestayUnit me hota hai
    roomsOf: (d) => d.totalBedrooms ?? 0,
    featuredOf: (d) => !!d.featured,
    ratingOf: (d) => d.averageRating ?? 0,
    searchFields: ["propertyName", "city", "state", "hostName", "hostPhone", "hostEmail"],
    cityField: "city",
  },

  apartment: {
    label: "Apartment",
    model: StaysApartment,
    vendorField: "vendor",
    baseFilter: { isDeleted: { $ne: true } },
    statusKind: "enum",
    statusCase: "lower",
    statusEnum: ["draft", "pending", "approved", "rejected", "inactive"],
    nameOf: (d) => d.apartmentName,
    subtypeOf: (d) => d.propertyType || d.apartmentType,
    cityOf: (d) => d.city,
    stateOf: (d) => d.state,
    imageOf: (d) => d.thumbnail || firstImage(d.images),
    priceOf: (d) => get(d, "pricing.basePrice", null),
    roomsOf: (d) => d.totalUnits ?? d.bedrooms ?? 0,
    featuredOf: (d) => !!d.featured,
    ratingOf: (d) => d.averageRating ?? 0,
    searchFields: ["apartmentName", "city", "state", "hostName", "phone", "email", "societyName"],
    cityField: "city",
  },

  villa: {
    label: "Villa",
    model: StaysVilla,
    vendorField: "vendorId",
    baseFilter: {},
    statusKind: "enum",
    statusCase: "upper",
    statusEnum: ["PENDING", "APPROVED", "REJECTED", "INACTIVE"],
    defaultStatus: "APPROVED", // vendor VacationHouse me status field hi nahi hai
    nameOf: (d) => d.propertyName,
    subtypeOf: () => "villa",
    cityOf: (d) => get(d, "address.city"),
    stateOf: (d) => get(d, "address.state"),
    imageOf: (d) => firstImage(d.images?.frontView),
    priceOf: (d) => get(d, "pricing.basePrice", null),
    roomsOf: () => 1,
    featuredOf: (d) => !!d.featured,
    ratingOf: (d) => d.starRating ?? 0,
    searchFields: ["propertyName", "address.city", "address.state", "owner.ownerName", "owner.phone"],
    cityField: "address.city",
  },

  palace: {
    label: "Palace",
    model: StaysPalace,
    vendorField: "vendor",
    baseFilter: {},
    statusKind: "enum",
    statusCase: "upper",
    statusEnum: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "INACTIVE"],
    nameOf: (d) => d.propertyName,
    subtypeOf: (d) => d.propertyType,
    cityOf: (d) => get(d, "address.city"),
    stateOf: (d) => get(d, "address.state"),
    imageOf: (d) => get(d, "coverImage.url") || firstImage(d.images),
    priceOf: () => null, // price rate plan me hota hai
    roomsOf: (d) => d.totalRooms ?? 0,
    featuredOf: (d) => !!d.isFeatured,
    ratingOf: (d) => d.starRating ?? 0,
    searchFields: ["propertyName", "address.city", "address.state", "contact.phone", "contact.email"],
    cityField: "address.city",
    featuredField: "isFeatured",
  },

  resort: {
    label: "Resort",
    model: StaysResort,
    vendorField: "vendor",
    baseFilter: {},
    statusKind: "enum",
    statusCase: "upper",
    statusEnum: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "INACTIVE"],
    nameOf: (d) => d.name,
    subtypeOf: (d) => d.propertyType,
    cityOf: (d) => get(d, "address.city"),
    stateOf: (d) => get(d, "address.state"),
    imageOf: (d) => get(d, "coverImage.url") || firstImage(d.images),
    priceOf: () => null,
    roomsOf: () => 0,
    featuredOf: (d) => !!(d.isFeatured ?? d.featured),
    ratingOf: (d) => d.starRating ?? 0,
    searchFields: ["name", "address.city", "address.state", "contact.phone", "contact.email"],
    cityField: "address.city",
    featuredField: "isFeatured",
  },

  bnb: {
    label: "BnB",
    model: StaysBnb,
    vendorField: "vendor", // bnb schema me vendor ref nahi hai, hota hai to use ho jaata hai
    baseFilter: {},
    statusKind: "boolean", // sirf isApproved
    statusEnum: [],
    nameOf: (d) => d.propertyName,
    subtypeOf: (d) => d.propertyType,
    cityOf: (d) => d.city,
    stateOf: (d) => d.state,
    imageOf: (d) =>
      firstImage(d.frontImages) || firstImage(d.propertyImages) || firstImage(d.receptionImages),
    priceOf: (d) => d.basePrice ?? null,
    roomsOf: (d) => d.totalRooms ?? 0,
    featuredOf: (d) => !!d.isFeatured,
    ratingOf: (d) => d.starCategory ?? 0,
    searchFields: ["propertyName", "propertyId", "city", "state", "ownerName", "contactNumber", "email"],
    cityField: "city",
    featuredField: "isFeatured",
  },
};

export const STAY_TYPE_KEYS = Object.keys(STAY_TYPES);

function minRoomPrice(rooms) {
  if (!Array.isArray(rooms) || !rooms.length) return null;
  const prices = rooms
    .map((r) => r.offerPrice || r.basePrice)
    .filter((n) => typeof n === "number" && n > 0);
  return prices.length ? Math.min(...prices) : null;
}

/* ============================================================
   STATUS HELPERS
============================================================ */

/** Vendor ka status value -> admin ka normalized UPPERCASE status */
export function normalizeStatus(type, doc) {
  const cfg = STAY_TYPES[type];

  if (cfg.statusKind === "boolean") {
    if (doc.isActive === false) return "INACTIVE";
    return doc.isApproved ? "APPROVED" : "PENDING";
  }

  const raw = doc.status ?? cfg.defaultStatus ?? "PENDING";
  const upper = String(raw).toUpperCase();

  // soft-disable flag wali types (hotel etc.)
  if (upper === "APPROVED" && doc.isActive === false) return "INACTIVE";
  return upper;
}

/** Admin ka action -> vendor DB me likhne wala patch (case aur type ke hisaab se) */
export function buildStatusPatch(type, action, { reason = "", adminId = null } = {}) {
  const cfg = STAY_TYPES[type];
  const now = new Date();
  const patch = {};

  const writeStatus = (value) => {
    const target = cfg.statusEnum.find((s) => s.toUpperCase() === value);
    // enum me value na ho (e.g. hotel me SUSPENDED nahi) to isActive se handle hoga
    return target || null;
  };

  const withAdmin = () => {
    if (adminId && mongoose.isValidObjectId(adminId)) {
      patch.approvedBy = adminId;
    }
    patch.approvedAt = now;
  };

  if (cfg.statusKind === "boolean") {
    // BnB
    switch (action) {
      case "approve":
        patch.isApproved = true;
        patch.isActive = true;
        break;
      case "reject":
        patch.isApproved = false;
        patch.isActive = false;
        patch.rejectionReason = reason;
        break;
      case "suspend":
        patch.isActive = false;
        break;
      case "reactivate":
        patch.isActive = true;
        break;
      default:
        return null;
    }
    return patch;
  }

  switch (action) {
    case "approve": {
      const v = writeStatus("APPROVED");
      if (v) patch.status = v;
      patch.isActive = true;
      patch.rejectionReason = "";
      withAdmin();
      break;
    }
    case "reject": {
      const v = writeStatus("REJECTED");
      if (v) patch.status = v;
      patch.rejectionReason = reason;
      patch.isActive = false;
      break;
    }
    case "suspend": {
      const v = writeStatus("SUSPENDED") || writeStatus("INACTIVE");
      if (v) patch.status = v;
      patch.isActive = false;
      if (reason) patch.suspensionReason = reason;
      break;
    }
    case "reactivate": {
      const v = writeStatus("APPROVED");
      if (v) patch.status = v;
      patch.isActive = true;
      break;
    }
    default:
      return null;
  }

  return patch;
}

/** Status filter (admin UPPERCASE) -> vendor DB ka query condition */
export function buildStatusFilter(type, status) {
  if (!status) return null;
  const cfg = STAY_TYPES[type];
  const upper = String(status).toUpperCase();

  if (cfg.statusKind === "boolean") {
    if (upper === "APPROVED") return { isApproved: true, isActive: { $ne: false } };
    if (upper === "PENDING") return { isApproved: { $ne: true } };
    if (upper === "REJECTED") return { isApproved: false, rejectionReason: { $exists: true, $ne: "" } };
    if (upper === "INACTIVE" || upper === "SUSPENDED") return { isActive: false };
    return null;
  }

  const stored = cfg.statusCase === "lower" ? upper.toLowerCase() : upper;

  if (upper === "INACTIVE" || upper === "SUSPENDED") {
    return {
      $or: [
        { status: stored },
        { status: cfg.statusCase === "lower" ? "approved" : "APPROVED", isActive: false },
      ],
    };
  }

  if (upper === "APPROVED") {
    return { status: stored, isActive: { $ne: false } };
  }

  // villa: status field nahi hota, missing = APPROVED
  if (cfg.defaultStatus && upper === cfg.defaultStatus) {
    return { $or: [{ status: stored }, { status: { $exists: false } }] };
  }

  return { status: stored };
}

/* ============================================================
   NORMALIZER - list/card ke liye ek jaisa shape
============================================================ */

export function summarizeStay(type, doc, vendorMap = {}) {
  const cfg = STAY_TYPES[type];
  const d = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const vendorId = d[cfg.vendorField] ? String(d[cfg.vendorField]) : null;
  const vendor = vendorId ? vendorMap[vendorId] : null;

  return {
    id: String(d._id),
    type,
    typeLabel: cfg.label,
    name: cfg.nameOf(d) || "(unnamed)",
    subtype: cfg.subtypeOf(d) || null,
    status: normalizeStatus(type, d),
    isActive: d.isActive !== false,
    featured: cfg.featuredOf(d),
    rejectionReason: d.rejectionReason || "",
    city: cfg.cityOf(d) || "",
    state: cfg.stateOf(d) || "",
    image: cfg.imageOf(d) || "",
    startingPrice: cfg.priceOf(d),
    roomCount: cfg.roomsOf(d),
    rating: cfg.ratingOf(d),
    totalReviews: d.totalReviews ?? 0,
    vendor: vendor
      ? {
          id: vendorId,
          name: vendor.name || vendor.businessName || vendor.companyName || "",
          businessName: vendor.businessName || vendor.companyName || "",
          email: vendor.email || "",
          phone: vendor.phone || "",
          kycStatus: vendor.kycStatus || "",
        }
      : vendorId
      ? { id: vendorId }
      : d.vendorName
      ? { id: null, name: d.vendorName }
      : null,
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
}

/* ============================================================
   BOOKING REGISTRY (5 booking collections -> 1 shape)
============================================================ */

export const BOOKING_TYPES = {
  hotel: {
    model: StaysHotelBooking,
    propertyField: "hotel",
    roomField: "room",
    refOf: (b) => b.bookingNumber,
    guestOf: (b) => ({ name: get(b, "guest.name", ""), email: get(b, "guest.email", ""), phone: get(b, "guest.phone", "") }),
    checkInField: "checkIn",
    checkOutField: "checkOut",
    statusField: "bookingStatus",
    paymentStatusField: "paymentStatus",
    amountField: "totalAmount",
    amountOf: (b) => b.totalAmount ?? 0,
    commissionOf: (b) => b.adminCommission ?? null,
    vendorAmountOf: (b) => b.vendorAmount ?? null,
    settlementField: "settlementStatus",
    refField: "bookingNumber",
    searchFields: ["bookingNumber", "guest.name", "guest.email", "guest.phone"],
  },
  homestay: {
    model: StaysHomestayBooking,
    propertyField: "homestay",
    roomField: "unit",
    refOf: (b) => b.bookingId,
    guestOf: (b) => ({ name: b.guestName || "", email: b.guestEmail || "", phone: b.guestPhone || "" }),
    checkInField: "checkInDate",
    checkOutField: "checkOutDate",
    statusField: "bookingStatus",
    paymentStatusField: "paymentStatus",
    amountField: "totalAmount",
    amountOf: (b) => b.totalAmount ?? 0,
    commissionOf: (b) => b.adminCommissionAmount ?? null,
    vendorAmountOf: (b) => b.vendorAmount ?? null,
    settlementField: "settlementStatus",
    refField: "bookingId",
    searchFields: ["bookingId", "guestName", "guestEmail", "guestPhone"],
  },
  apartment: {
    model: StaysApartmentBooking,
    propertyField: "apartment",
    roomField: null,
    refOf: (b) => b.bookingId,
    guestOf: (b) => ({
      name: [get(b, "guest.firstName", ""), get(b, "guest.lastName", "")].join(" ").trim(),
      email: get(b, "guest.email", ""),
      phone: get(b, "guest.phone", ""),
    }),
    checkInField: "checkInDate",
    checkOutField: "checkOutDate",
    statusField: "bookingStatus",
    paymentStatusField: "paymentStatus",
    amountField: "pricing.totalAmount",
    amountOf: (b) => get(b, "pricing.totalAmount", 0),
    commissionOf: () => null,
    vendorAmountOf: () => null,
    settlementField: null,
    refField: "bookingId",
    searchFields: ["bookingId", "guest.firstName", "guest.lastName", "guest.email", "guest.phone"],
  },
  palace: {
    model: StaysPalaceBooking,
    propertyField: "palace",
    roomField: "roomCategory",
    refOf: (b) => b.bookingReference,
    guestOf: (b) => ({ name: get(b, "guest.name", ""), email: get(b, "guest.email", ""), phone: get(b, "guest.phone", "") }),
    checkInField: "checkIn",
    checkOutField: "checkOut",
    statusField: "status",
    paymentStatusField: "payment.status",
    amountField: "pricing.totalAmount",
    amountOf: (b) => get(b, "pricing.totalAmount", 0),
    commissionOf: () => null,
    vendorAmountOf: () => null,
    settlementField: null,
    refField: "bookingReference",
    searchFields: ["bookingReference", "guest.name", "guest.email", "guest.phone"],
  },
  resort: {
    model: StaysResortBooking,
    propertyField: "resort",
    roomField: "roomCategory",
    refOf: (b) => b.bookingId,
    guestOf: (b) => ({ name: get(b, "leadGuest.name", ""), email: get(b, "leadGuest.email", ""), phone: get(b, "leadGuest.phone", "") }),
    checkInField: "checkIn",
    checkOutField: "checkOut",
    statusField: "bookingStatus",
    paymentStatusField: "paymentStatus",
    amountField: "pricing.totalAmount",
    amountOf: (b) => get(b, "pricing.totalAmount", 0),
    commissionOf: () => null,
    vendorAmountOf: () => null,
    settlementField: null,
    refField: "bookingId",
    searchFields: ["bookingId", "leadGuest.name", "leadGuest.email", "leadGuest.phone"],
  },
};

export const BOOKING_TYPE_KEYS = Object.keys(BOOKING_TYPES);

export function summarizeBooking(type, doc, propertyMap = {}) {
  const cfg = BOOKING_TYPES[type];
  const b = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const propId = b[cfg.propertyField] ? String(b[cfg.propertyField]) : null;

  return {
    id: String(b._id),
    type,
    reference: cfg.refOf(b) || String(b._id),
    property: propId ? propertyMap[propId] || { id: propId } : null,
    vendorId: b.vendor ? String(b.vendor) : null,
    guest: cfg.guestOf(b),
    checkIn: b[cfg.checkInField] || null,
    checkOut: b[cfg.checkOutField] || null,
    nights: b.nights ?? b.totalNights ?? null,
    status: String(get(b, cfg.statusField, "PENDING")).toUpperCase(),
    paymentStatus: String(get(b, cfg.paymentStatusField, "PENDING")).toUpperCase(),
    amount: cfg.amountOf(b),
    commission: cfg.commissionOf(b),
    vendorAmount: cfg.vendorAmountOf(b),
    settlementStatus: cfg.settlementField ? b[cfg.settlementField] || null : null,
    createdAt: b.createdAt || null,
  };
}

export { COLLECTIONS, get as pick };