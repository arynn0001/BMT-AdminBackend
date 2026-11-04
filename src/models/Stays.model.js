/**
 * Stays Model (Admin)
 *
 * Vendor aur Admin SAME MongoDB use karte hain. Collections ko strict:false
 * schema se bind kiya gaya hai, taaki vendor ke saare fields fetch hon.
 *
 * Covered: Hotel, Motel, Homestay, Apartment, Service Apartment, Villa,
 *          Vacation House, Guest House, Palace, Resort, BnB, Hostel, Campsite
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

/* ============================================================
   SERVICE APARTMENT SETTING
   ------------------------------------------------------------
   false (default) -> Service Apartment = Apartment ka hi alias.
                      Same collection, same API, same data. Sirf alag
                      module/naam. Totals me double count nahi hota.
   true            -> Vendor side apartment ka propertyType/apartmentType
                      "service" wala ho to wo Service Apartment me jayega
                      aur Apartment me nahi dikhega.
============================================================ */

export const SERVICE_APARTMENT_SPLIT = false;
const SERVICE_RX = /service/i;

/* ============================================================
   COLLECTION BINDINGS
============================================================ */

const COLLECTIONS = {
  // Properties
  hotel: "hotels",
  motel: "motels",
  homestay: "homestays",
  apartment: "vendorapartments",
  palace: "palaces",
  resort: "resorts",
  bnb: "bnbproperties",
  villa: "villas",
  vacationHouse: "vacationhouses",
  guestHouse: "guesthouses",
  hostel: "hostels",
  campsite: "campsites",              // ✅ naya (vendor: Campsite model)
  motelOperator: "motelvendors",

  // Rooms / units
  hotelRoom: "hotelrooms",
  motelRoom: "motelrooms",
  homestayUnit: "homestayunits",
  palaceRoomCategory: "palaceroomcategories",
  palaceRoomUnit: "palaceroomunits",
  resortRoom: "resortrooms",
  resortRoomUnit: "resortroomunits",
  hostelRoom: "hostelrooms",
  hostelBed: "hostelbeds",
  villaRoom: "villaroomtypes",
  vacationHouseRoom: "vacationhouseroomtypes",
  guestHouseRoom: "guesthouserooms",
  campsiteUnit: "campsiteunits",      // ✅ naya (vendor: CampsiteUnit model)

  // Rates
  apartmentRatePlan: "apartmentrateplans",
  palaceRatePlan: "palacerateplans",
  resortRatePlan: "resortrateplans",

  // Inventory
  hotelInventory: "hotelinventories",
  motelInventory: "motelinventories",
  villaInventory: "villinventories",
  vacationHouseInventory: "vacationhouseinventories",
  guestHouseInventory: "guesthouseinventories",
  homestayInventory: "homestayinventories",
  apartmentInventory: "apartmentinventories",
  palaceInventory: "palaceinventories",
  resortInventory: "resortinventories",

  // Bookings
  hotelBooking: "hotelbookings",
  motelBooking: "motelbookings",
  villaBooking: "villabookings",
  vacationHouseBooking: "vacationhousebookings",
  guestHouseBooking: "guesthousebookings",
  homestayBooking: "homestaybookings",
  apartmentBooking: "apartmentbookings",
  palaceBooking: "palacebookings",
  resortBooking: "resortbookings",
  hostelBooking: "hostelbookings",

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
      strict: false,
      collection,
      timestamps: false,
      versionKey: false,
    }
  );

  return mongoose.model(key, schema);
}

export const StaysHotel = bind("Hotel", COLLECTIONS.hotel);
export const StaysMotel = bind("Motel", COLLECTIONS.motel);
export const StaysHomestay = bind("Homestay", COLLECTIONS.homestay);
export const StaysApartment = bind("Apartment", COLLECTIONS.apartment);
export const StaysPalace = bind("Palace", COLLECTIONS.palace);
export const StaysResort = bind("Resort", COLLECTIONS.resort);
export const StaysBnb = bind("Bnb", COLLECTIONS.bnb);
export const StaysVilla = bind("Villa", COLLECTIONS.villa);
export const StaysVacationHouse = bind("VacationHouse", COLLECTIONS.vacationHouse);
export const StaysGuestHouse = bind("GuestHouse", COLLECTIONS.guestHouse);
export const StaysCampsite = bind("Campsite", COLLECTIONS.campsite);   // ✅
export const StaysMotelOperator = bind("MotelOperator", COLLECTIONS.motelOperator);

export const StaysHotelRoom = bind("HotelRoom", COLLECTIONS.hotelRoom);
export const StaysMotelRoom = bind("MotelRoom", COLLECTIONS.motelRoom);
export const StaysHomestayUnit = bind("HomestayUnit", COLLECTIONS.homestayUnit);
export const StaysPalaceRoomCategory = bind("PalaceRoomCategory", COLLECTIONS.palaceRoomCategory);
export const StaysPalaceRoomUnit = bind("PalaceRoomUnit", COLLECTIONS.palaceRoomUnit);
export const StaysResortRoom = bind("ResortRoom", COLLECTIONS.resortRoom);
export const StaysResortRoomUnit = bind("ResortRoomUnit", COLLECTIONS.resortRoomUnit);
export const StaysVillaRoom = bind("VillaRoom", COLLECTIONS.villaRoom);
export const StaysVacationHouseRoom = bind("VacationHouseRoom", COLLECTIONS.vacationHouseRoom);
export const StaysGuestHouseRoom = bind("GuestHouseRoom", COLLECTIONS.guestHouseRoom);
export const StaysCampsiteUnit = bind("CampsiteUnit", COLLECTIONS.campsiteUnit);   // ✅

export const StaysApartmentRatePlan = bind("ApartmentRatePlan", COLLECTIONS.apartmentRatePlan);
export const StaysPalaceRatePlan = bind("PalaceRatePlan", COLLECTIONS.palaceRatePlan);
export const StaysResortRatePlan = bind("ResortRatePlan", COLLECTIONS.resortRatePlan);

export const StaysHotelInventory = bind("HotelInventory", COLLECTIONS.hotelInventory);
export const StaysMotelInventory = bind("MotelInventory", COLLECTIONS.motelInventory);
export const StaysVillaInventory = bind("VillaInventory", COLLECTIONS.villaInventory);
export const StaysVacationHouseInventory = bind("VacationHouseInventory", COLLECTIONS.vacationHouseInventory);
export const StaysGuestHouseInventory = bind("GuestHouseInventory", COLLECTIONS.guestHouseInventory);
export const StaysHomestayInventory = bind("HomestayInventory", COLLECTIONS.homestayInventory);
export const StaysApartmentInventory = bind("ApartmentInventory", COLLECTIONS.apartmentInventory);
export const StaysPalaceInventory = bind("PalaceInventory", COLLECTIONS.palaceInventory);
export const StaysResortInventory = bind("ResortInventory", COLLECTIONS.resortInventory);

export const StaysHotelBooking = bind("HotelBooking", COLLECTIONS.hotelBooking);
export const StaysMotelBooking = bind("MotelBooking", COLLECTIONS.motelBooking);
export const StaysVillaBooking = bind("VillaBooking", COLLECTIONS.villaBooking);
export const StaysVacationHouseBooking = bind("VacationHouseBooking", COLLECTIONS.vacationHouseBooking);
export const StaysGuestHouseBooking = bind("GuestHouseBooking", COLLECTIONS.guestHouseBooking);
export const StaysHomestayBooking = bind("HomestayBooking", COLLECTIONS.homestayBooking);
export const StaysApartmentBooking = bind("ApartmentBooking", COLLECTIONS.apartmentBooking);
export const StaysPalaceBooking = bind("PalaceBooking", COLLECTIONS.palaceBooking);
export const StaysResortBooking = bind("ResortBooking", COLLECTIONS.resortBooking);

export const StaysHomestayReview = bind("HomestayReview", COLLECTIONS.homestayReview);
export const StaysResortReview = bind("ResortReview", COLLECTIONS.resortReview);

export const StaysHostel = bind("Hostel", COLLECTIONS.hostel);
export const StaysHostelRoom = bind("HostelRoom", COLLECTIONS.hostelRoom);
export const StaysHostelBed = bind("HostelBed", COLLECTIONS.hostelBed);
export const StaysHostelBooking = bind("HostelBooking", COLLECTIONS.hostelBooking);

export const StaysVendor = bind("Vendor", COLLECTIONS.vendor);

/* ============================================================ */

export const STAY_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "INACTIVE",
  "SUSPENDED",
];

/* ============================================================ */

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
    baseFilter: {},
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
    model: StaysMotel,
    vendorField: "vendorId",
    vendorAltField: "vendor",
    baseFilter: {},
    statusKind: "motel",
    statusEnum: [],
    nameOf: (d) => d.motelName || d.name,
    subtypeOf: (d) => d.motelType || "motel",
    cityOf: (d) => d.city || get(d, "address.city"),
    stateOf: (d) => d.state || get(d, "address.state"),
    imageOf: (d) => firstImage(d.images) || firstImage(d.motelImages) || d.coverImage || "",
    priceOf: (d) => d.pricePerNight ?? d.basePrice ?? null,
    roomsOf: (d) => d.totalRooms ?? 0,
    featuredOf: (d) => !!d.featured,
    ratingOf: (d) => d.averageRating ?? 0,
    searchFields: ["motelName", "name", "city", "state", "phone", "email", "addressLine", "pincode"],
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
    priceOf: () => null,
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
    baseFilter: SERVICE_APARTMENT_SPLIT
      ? { isDeleted: { $ne: true }, $nor: [{ propertyType: SERVICE_RX }, { apartmentType: SERVICE_RX }] }
      : { isDeleted: { $ne: true } },
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
    statusKind: "vacation",
    statusEnum: [],
    nameOf: (d) => d.propertyName,
    subtypeOf: (d) => d.propertyType || "Villa",
    cityOf: (d) => get(d, "address.city"),
    stateOf: (d) => get(d, "address.state"),
    imageOf: (d) =>
      firstImage(d.images?.frontView) ||
      firstImage(d.images?.bedRoom) ||
      firstImage(d.images?.kitchen) ||
      firstImage(d.images?.washroom),
    priceOf: (d) => get(d, "pricing.basePrice", null),
    roomsOf: (d) => d.bedrooms ?? 1,
    featuredOf: (d) => !!d.featured,
    ratingOf: (d) => d.starRating ?? 0,
    searchFields: [
      "propertyName", "propertyId", "propertyType",
      "address.city", "address.state", "address.pincode",
      "owner.ownerName", "owner.phone", "owner.email",
    ],
    cityField: "address.city",
  },

  vacationhouse: {
    label: "Vacation House",
    model: StaysVacationHouse,
    vendorField: "vendorId",
    baseFilter: {},
    statusKind: "vacation",
    statusEnum: [],
    nameOf: (d) => d.propertyName,
    subtypeOf: (d) => d.propertyType || "Vacation Home",
    cityOf: (d) => get(d, "address.city"),
    stateOf: (d) => get(d, "address.state"),
    imageOf: (d) =>
      firstImage(d.images?.frontView) ||
      firstImage(d.images?.bedRoom) ||
      firstImage(d.images?.kitchen) ||
      firstImage(d.images?.washroom),
    priceOf: (d) => get(d, "pricing.basePrice", null),
    roomsOf: (d) => d.bedrooms ?? 1,
    featuredOf: (d) => !!d.featured,
    ratingOf: (d) => d.starRating ?? 0,
    searchFields: [
      "propertyName", "propertyId", "propertyType",
      "address.city", "address.state", "address.pincode",
      "owner.ownerName", "owner.phone", "owner.email",
    ],
    cityField: "address.city",
  },

  // GUEST HOUSE — "guesthouses" collection.
  guesthouse: {
    label: "Guest House",
    model: StaysGuestHouse,
    vendorField: "vendor",
    baseFilter: {},
    statusKind: "enum",
    statusCase: "lower",
    statusEnum: ["pending", "approved", "rejected"],
    nameOf: (d) => d.guestHouseName,
    subtypeOf: (d) => d.guestHouseType,
    cityOf: (d) => d.city,
    stateOf: (d) => d.state,
    imageOf: (d) => firstImage(d.guestHouseImages),
    priceOf: (d) => d.pricePerNight ?? null,
    roomsOf: (d) => d.totalRooms ?? 0,
    featuredOf: (d) => !!d.featured,
    ratingOf: (d) => d.averageRating ?? 0,
    searchFields: ["guestHouseName", "city", "state", "phone", "email", "area", "hostName"],
    cityField: "city",
  },

  // ✅ CAMPSITE — "campsites" collection (vendor model: Campsite)
  // Vendor schema: vendorId, name, description, location{address,city,state,pincode},
  // contact{name,phone,email}, amenities[], rules[], basePrice, maxGuests,
  // images{cover,gallery[]}, documents[], status enum [active, inactive, pending] (default active).
  // Admin status mapping:
  //   active   -> APPROVED
  //   pending  -> PENDING
  //   inactive -> INACTIVE  (rejectionReason ho to REJECTED, suspensionReason ho to SUSPENDED)
  campsite: {
    label: "Campsite",
    model: StaysCampsite,
    vendorField: "vendorId",
    baseFilter: {},
    statusKind: "campsite",
    statusEnum: [],
    nameOf: (d) => d.name,
    subtypeOf: () => "Campsite",
    cityOf: (d) => get(d, "location.city"),
    stateOf: (d) => get(d, "location.state"),
    imageOf: (d) => get(d, "images.cover") || firstImage(d.images?.gallery),
    priceOf: (d) => d.basePrice ?? null,
    roomsOf: () => 0,                         // tents/units CampsiteUnit se aate hain (rooms endpoint)
    featuredOf: (d) => !!d.featured,
    ratingOf: (d) => d.averageRating ?? 0,
    searchFields: [
      "name", "slug",
      "location.city", "location.state", "location.pincode", "location.address",
      "contact.name", "contact.phone", "contact.email",
    ],
    cityField: "location.city",
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
    priceOf: () => null,
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
    vendorField: "vendor",
    baseFilter: {},
    statusKind: "boolean",
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

  hostel: {
    label: "Hostel",
    model: StaysHostel,
    vendorField: "vendorId",
    baseFilter: {},
    statusKind: "active",
    statusEnum: [],
    nameOf: (d) => d.hostelName,
    subtypeOf: (d) => d.hostelType,
    cityOf: (d) => d.city,
    stateOf: (d) => d.state,
    imageOf: (d) => firstImage(d.images),
    priceOf: () => null,
    roomsOf: () => 0,
    featuredOf: (d) => !!d.featured,
    ratingOf: () => 0,
    searchFields: ["hostelName", "city", "state", "address", "contactName", "contactPhone", "contactEmail"],
    cityField: "city",
  },
};

// ✅ SERVICE APARTMENT — apartment ke saath SAME collection / same API.
// SPLIT=false: alias (aliasOf: "apartment") — rooms/rates/inventory/bookings apartment wale hi chalte hain.
STAY_TYPES.serviceapartment = {
  ...STAY_TYPES.apartment,
  label: "Service Apartment",
  aliasOf: SERVICE_APARTMENT_SPLIT ? null : "apartment",
  baseFilter: SERVICE_APARTMENT_SPLIT
    ? { isDeleted: { $ne: true }, $or: [{ propertyType: SERVICE_RX }, { apartmentType: SERVICE_RX }] }
    : STAY_TYPES.apartment.baseFilter,
};

/** Har type key (module list / validation). */
export const STAY_TYPE_KEYS = Object.keys(STAY_TYPES);

/** Totals / dashboard / vendor counts ke liye (alias double count nahi hota). */
export const STAY_DEFAULT_KEYS = STAY_TYPE_KEYS.filter((k) => !STAY_TYPES[k].aliasOf);

/** Alias ko asli type me badalta hai (rooms/rates/inventory lookup ke liye). */
export const canon = (type) => (STAY_TYPES[type] && STAY_TYPES[type].aliasOf) || type;

function minRoomPrice(rooms) {
  if (!Array.isArray(rooms) || !rooms.length) return null;
  const prices = rooms
    .map((r) => r.offerPrice || r.basePrice)
    .filter((n) => typeof n === "number" && n > 0);
  return prices.length ? Math.min(...prices) : null;
}

/* ============================================================ */

export function vendorIdOf(cfg, d) {
  const v = d?.[cfg.vendorField] ?? (cfg.vendorAltField ? d?.[cfg.vendorAltField] : null);
  return v ? String(v) : null;
}

export function vendorClause(cfg, value) {
  const fields = [cfg.vendorField, cfg.vendorAltField].filter(Boolean);
  if (fields.length === 1) return { [fields[0]]: value };
  return { $or: fields.map((f) => ({ [f]: value })) };
}

export function vendorExpr(cfg) {
  if (!cfg.vendorAltField) return `$${cfg.vendorField}`;
  return { $ifNull: [`$${cfg.vendorField}`, `$${cfg.vendorAltField}`] };
}

/* ============================================================ */

const isBlank = (v) => v === undefined || v === null || v === "";

export function normalizeStatus(type, doc) {
  const cfg = STAY_TYPES[type];

  if (cfg.statusKind === "active") {
    return doc.isActive === false ? "INACTIVE" : "APPROVED";
  }

  if (cfg.statusKind === "boolean") {
    if (doc.isActive === false) return "INACTIVE";
    return doc.isApproved ? "APPROVED" : "PENDING";
  }

  if (cfg.statusKind === "vacation") {
    const raw = String(doc.status ?? "active").toLowerCase();
    if (raw !== "inactive") return "APPROVED";
    if (!isBlank(doc.rejectionReason)) return "REJECTED";
    if (!isBlank(doc.suspensionReason)) return "SUSPENDED";
    return "INACTIVE";
  }

  // ✅ Campsite: active | pending | inactive
  if (cfg.statusKind === "campsite") {
    const raw = String(doc.status ?? "active").toLowerCase();
    if (raw === "pending") return "PENDING";
    if (raw === "inactive") {
      if (!isBlank(doc.rejectionReason)) return "REJECTED";
      if (!isBlank(doc.suspensionReason)) return "SUSPENDED";
      return "INACTIVE";
    }
    return "APPROVED";
  }

  if (cfg.statusKind === "motel") {
    const raw = String(doc.status ?? "").toLowerCase();
    if (raw === "rejected" || (doc.isApproved === false && !isBlank(doc.rejectionReason))) return "REJECTED";
    if (raw === "pending" || doc.isApproved === false) return "PENDING";
    if (raw === "draft") return "DRAFT";
    if (raw === "suspended") return "SUSPENDED";
    if (raw === "inactive" || doc.isActive === false) return "INACTIVE";
    return "APPROVED";
  }

  const raw = doc.status ?? cfg.defaultStatus ?? "PENDING";
  const upper = String(raw).toUpperCase();

  if (upper === "APPROVED" && doc.isActive === false) return "INACTIVE";
  return upper;
}

export function buildStatusPatch(type, action, { reason = "", adminId = null } = {}) {
  const cfg = STAY_TYPES[type];
  const now = new Date();
  const patch = {};

  const writeStatus = (value) => {
    const target = cfg.statusEnum.find((s) => s.toUpperCase() === value);
    return target || null;
  };

  const withAdmin = () => {
    if (adminId && mongoose.isValidObjectId(adminId)) {
      patch.approvedBy = adminId;
    }
    patch.approvedAt = now;
  };

  if (cfg.statusKind === "active") {
    switch (action) {
      case "approve":
      case "reactivate":
        patch.isActive = true;
        patch.rejectionReason = "";
        break;
      case "reject":
        patch.isActive = false;
        patch.rejectionReason = reason;
        break;
      case "suspend":
        patch.isActive = false;
        if (reason) patch.suspensionReason = reason;
        break;
      default:
        return null;
    }
    return patch;
  }

  if (cfg.statusKind === "boolean") {
    switch (action) {
      case "approve": patch.isApproved = true; patch.isActive = true; break;
      case "reject": patch.isApproved = false; patch.isActive = false; patch.rejectionReason = reason; break;
      case "suspend": patch.isActive = false; break;
      case "reactivate": patch.isActive = true; break;
      default: return null;
    }
    return patch;
  }

  if (cfg.statusKind === "vacation") {
    switch (action) {
      case "approve":
      case "reactivate":
        patch.status = "active";
        patch.rejectionReason = "";
        patch.suspensionReason = "";
        if (action === "approve") withAdmin();
        break;
      case "reject":
        patch.status = "inactive";
        patch.rejectionReason = reason;
        patch.suspensionReason = "";
        break;
      case "suspend":
        patch.status = "inactive";
        patch.suspensionReason = reason || "Suspended by admin";
        patch.rejectionReason = "";
        break;
      default:
        return null;
    }
    return patch;
  }

  // ✅ Campsite
  if (cfg.statusKind === "campsite") {
    switch (action) {
      case "approve":
      case "reactivate":
        patch.status = "active";
        patch.rejectionReason = "";
        patch.suspensionReason = "";
        if (action === "approve") withAdmin();
        break;
      case "reject":
        patch.status = "inactive";
        patch.rejectionReason = reason;
        patch.suspensionReason = "";
        break;
      case "suspend":
        patch.status = "inactive";
        patch.suspensionReason = reason || "Suspended by admin";
        patch.rejectionReason = "";
        break;
      default:
        return null;
    }
    return patch;
  }

  if (cfg.statusKind === "motel") {
    switch (action) {
      case "approve":
      case "reactivate":
        patch.status = "active";
        patch.isActive = true;
        patch.isApproved = true;
        patch.rejectionReason = "";
        withAdmin();
        break;
      case "reject":
        patch.status = "inactive";
        patch.isActive = false;
        patch.isApproved = false;
        patch.rejectionReason = reason;
        break;
      case "suspend":
        patch.status = "inactive";
        patch.isActive = false;
        if (reason) patch.suspensionReason = reason;
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

export function buildStatusFilter(type, status) {
  if (!status) return null;
  const cfg = STAY_TYPES[type];
  const upper = String(status).toUpperCase();

  if (cfg.statusKind === "active") {
    if (upper === "APPROVED") return { isActive: { $ne: false } };
    if (["INACTIVE", "SUSPENDED", "REJECTED"].includes(upper)) return { isActive: false };
    return { _id: { $exists: false } };
  }

  if (cfg.statusKind === "boolean") {
    if (upper === "APPROVED") return { isApproved: true, isActive: { $ne: false } };
    if (upper === "PENDING") return { isApproved: { $ne: true } };
    if (upper === "REJECTED") return { isApproved: false, rejectionReason: { $exists: true, $ne: "" } };
    if (upper === "INACTIVE" || upper === "SUSPENDED") return { isActive: false };
    return null;
  }

  if (cfg.statusKind === "vacation" || cfg.statusKind === "campsite") {
    const blank = (f) => ({ $or: [{ [f]: { $exists: false } }, { [f]: { $in: ["", null] } }] });
    const filled = (f) => ({ [f]: { $exists: true, $nin: ["", null] } });
    const isCamp = cfg.statusKind === "campsite";

    switch (upper) {
      case "APPROVED":
        return isCamp ? { status: { $nin: ["inactive", "pending"] } } : { status: { $ne: "inactive" } };
      case "PENDING":
        return isCamp ? { status: "pending" } : { _id: { $exists: false } };
      case "REJECTED": return { status: "inactive", ...filled("rejectionReason") };
      case "SUSPENDED": return { status: "inactive", ...filled("suspensionReason"), ...blank("rejectionReason") };
      case "INACTIVE": return { status: "inactive", $and: [blank("rejectionReason"), blank("suspensionReason")] };
      default: return { _id: { $exists: false } };
    }
  }

  if (cfg.statusKind === "motel") {
    const hasReason = { rejectionReason: { $exists: true, $nin: ["", null] } };
    const noReason = { $or: [{ rejectionReason: { $exists: false } }, { rejectionReason: { $in: ["", null] } }] };

    switch (upper) {
      case "REJECTED": return { $or: [{ status: "rejected" }, { isApproved: false, ...hasReason }] };
      case "PENDING": return { $or: [{ status: "pending" }, { $and: [{ isApproved: false }, noReason, { status: { $ne: "rejected" } }] }] };
      case "DRAFT": return { status: "draft" };
      case "SUSPENDED": return { status: "suspended" };
      case "INACTIVE": return { $or: [{ status: "inactive" }, { isActive: false }] };
      case "APPROVED":
        return {
          status: { $nin: ["draft", "inactive", "pending", "rejected", "suspended"] },
          isApproved: { $ne: false },
          isActive: { $ne: false },
        };
      default: return null;
    }
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

  if (cfg.defaultStatus && upper === cfg.defaultStatus) {
    return { $or: [{ status: stored }, { status: { $exists: false } }] };
  }

  return { status: stored };
}

/* ============================================================ */

export function summarizeStay(type, doc, vendorMap = {}) {
  const cfg = STAY_TYPES[type];
  const d = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const vendorId = vendorIdOf(cfg, d);
  const vendor = vendorId ? vendorMap[vendorId] : null;

  return {
    id: String(d._id),
    type,
    typeLabel: cfg.label,
    name: cfg.nameOf(d) || "(unnamed)",
    subtype: cfg.subtypeOf(d) || null,
    status: normalizeStatus(type, d),
    isActive:
      cfg.statusKind === "vacation"
        ? String(d.status ?? "active").toLowerCase() !== "inactive"
        : cfg.statusKind === "campsite"
        ? String(d.status ?? "active").toLowerCase() === "active"
        : d.isActive !== false,
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

/* ============================================================ */

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

  motel: {
    model: StaysMotelBooking,
    propertyField: "motelId",
    vendorField: "vendorId",
    roomField: "roomId",
    refOf: (b) => b.bookingRef,
    guestOf: (b) => ({ name: b.guestName || "", email: b.guestEmail || "", phone: b.guestPhone || "" }),
    checkInField: "checkInDate",
    checkOutField: "checkOutDate",
    statusField: "bookingStatus",
    paymentStatusField: "paymentStatus",
    amountField: "totalAmount",
    amountOf: (b) => b.totalAmount ?? 0,
    commissionOf: () => null,
    vendorAmountOf: () => null,
    settlementField: null,
    refField: "bookingRef",
    searchFields: ["bookingRef", "guestName", "guestEmail", "guestPhone", "motelName", "roomName", "roomNumber"],
  },

  villa: {
    model: StaysVillaBooking,
    propertyField: "houseId",
    vendorField: "vendorId",
    roomField: null,
    dateType: "string",
    refOf: (b) => b.bookingId,
    guestOf: (b) => ({ name: get(b, "guest.name", ""), email: get(b, "guest.email", ""), phone: get(b, "guest.phone", "") }),
    checkInField: "checkIn",
    checkOutField: "checkOut",
    statusField: "status",
    paymentStatusField: "paymentStatus",
    amountField: "pricing.totalAmount",
    amountOf: (b) => get(b, "pricing.totalAmount", 0),
    commissionOf: () => null,
    vendorAmountOf: () => null,
    settlementField: null,
    refField: "bookingId",
    searchFields: ["bookingId", "guest.name", "guest.email", "guest.phone"],
  },

  vacationhouse: {
    model: StaysVacationHouseBooking,
    propertyField: "houseId",
    vendorField: "vendorId",
    roomField: null,
    dateType: "string",
    refOf: (b) => b.bookingId,
    guestOf: (b) => ({ name: get(b, "guest.name", ""), email: get(b, "guest.email", ""), phone: get(b, "guest.phone", "") }),
    checkInField: "checkIn",
    checkOutField: "checkOut",
    statusField: "status",
    paymentStatusField: "paymentStatus",
    amountField: "pricing.totalAmount",
    amountOf: (b) => get(b, "pricing.totalAmount", 0),
    commissionOf: () => null,
    vendorAmountOf: () => null,
    settlementField: null,
    refField: "bookingId",
    searchFields: ["bookingId", "guest.name", "guest.email", "guest.phone"],
  },

  // GUEST HOUSE booking (guesthousebookings)
  guesthouse: {
    model: StaysGuestHouseBooking,
    propertyField: "guestHouse",
    vendorField: "vendor",
    roomField: "room",
    refOf: (b) => b.bookingCode,
    guestOf: (b) => ({ name: b.guestName || "", email: b.guestEmail || "", phone: b.guestPhone || "" }),
    checkInField: "checkIn",
    checkOutField: "checkOut",
    statusField: "bookingStatus",
    paymentStatusField: "paymentStatus",
    amountField: "pricing.totalAmount",
    amountOf: (b) => get(b, "pricing.totalAmount", 0),
    commissionOf: () => null,
    vendorAmountOf: () => null,
    settlementField: null,
    refField: "bookingCode",
    searchFields: ["bookingCode", "guestName", "guestEmail", "guestPhone", "guestHouseName", "roomName"],
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

  hostel: {
    model: StaysHostelBooking,
    propertyField: "hostelId",
    vendorField: "vendorId",
    roomField: "roomId",
    refOf: (b) => b.bookingRef,
    guestOf: (b) => ({ name: b.guestName || "", email: b.guestEmail || "", phone: b.guestPhone || "" }),
    checkInField: "checkInDate",
    checkOutField: "checkOutDate",
    statusField: "bookingStatus",
    paymentStatusField: "paymentStatus",
    amountField: "totalAmount",
    amountOf: (b) => b.totalAmount ?? 0,
    commissionOf: () => null,
    vendorAmountOf: () => null,
    settlementField: null,
    refField: "bookingRef",
    searchFields: ["bookingRef", "guestName", "guestEmail", "guestPhone", "hostelName"],
  },
};

// ✅ Service Apartment bookings = apartment bookings (same collection `apartmentbookings`)
BOOKING_TYPES.serviceapartment = { ...BOOKING_TYPES.apartment };

export const BOOKING_TYPE_KEYS = Object.keys(BOOKING_TYPES);

/** Totals / dashboard / payouts ke liye (alias double count nahi hota). */
export const BOOKING_DEFAULT_KEYS = BOOKING_TYPE_KEYS.filter((k) => k !== "serviceapartment");

export function summarizeBooking(type, doc, propertyMap = {}) {
  const cfg = BOOKING_TYPES[type];
  const b = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const propId = b[cfg.propertyField] ? String(b[cfg.propertyField]) : null;
  const vKey = cfg.vendorField || "vendor";

  return {
    id: String(b._id),
    type,
    reference: cfg.refOf(b) || String(b._id),
    property: propId ? propertyMap[propId] || { id: propId } : null,
    vendorId: b[vKey] ? String(b[vKey]) : null,
    guest: cfg.guestOf(b),
    checkIn: b[cfg.checkInField] || null,
    checkOut: b[cfg.checkOutField] || null,
    nights: b.nights ?? b.totalNights ?? null,
    status: String(get(b, cfg.statusField, "PENDING")).toUpperCase().replace(/[-\s]/g, "_"),
    paymentStatus: String(get(b, cfg.paymentStatusField, "PENDING")).toUpperCase().replace(/[-\s]/g, "_"),
    amount: cfg.amountOf(b),
    commission: cfg.commissionOf(b),
    vendorAmount: cfg.vendorAmountOf(b),
    settlementStatus: cfg.settlementField ? b[cfg.settlementField] || null : null,
    createdAt: b.createdAt || null,
  };
}

export { COLLECTIONS, get as pick };