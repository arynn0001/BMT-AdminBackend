/**
 * Stays Controller (Admin)
 *
 * Vendor ne jo bhi data add kiya hai (Hotel, Motel, Homestay, Apartment,
 * Villa, Palace, Resort, BnB) vo yahan se admin panel ko milta hai.
 * Same MongoDB -> koi sync nahi chahiye, direct fetch hota hai.
 *
 * Response shape (baaki admin modules jaisa):
 *   success: { success: true, data, meta? }
 *   error  : { success: false, error: { code, message } }
 */

import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import {
  STAY_TYPES,
  STAY_TYPE_KEYS,
  STAY_STATUSES,
  BOOKING_TYPES,
  BOOKING_TYPE_KEYS,
  StaysVendor,
  StaysMotelOperator,
  StaysHotelRoom,
  StaysHomestayUnit,
  StaysPalaceRoomCategory,
  StaysPalaceRoomUnit,
  StaysResortRoom,
  StaysResortRoomUnit,
  StaysApartmentRatePlan,
  StaysPalaceRatePlan,
  StaysResortRatePlan,
  StaysHotelInventory,
  StaysHomestayInventory,
  StaysApartmentInventory,
  StaysPalaceInventory,
  StaysResortInventory,
  StaysHomestayReview,
  StaysResortReview,
  buildStatusFilter,
  buildStatusPatch,
  normalizeStatus,
  summarizeStay,
  summarizeBooking,
} from "../models/Stays.model.js";

/* ============================================================
   SMALL HELPERS
============================================================ */

const isId = (v) => mongoose.isValidObjectId(v);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sendOk = (res, data, meta) =>
  res.json({ success: true, data, ...(meta ? { meta } : {}) });

const sendErr = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message } });

/** try/catch wrapper - controller me baar baar try/catch na likhna pade */
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    logger.error({ err }, `Stays controller error: ${req.method} ${req.originalUrl}`);
    sendErr(res, 500, "INTERNAL_ERROR", err.message || "Something went wrong");
  }
};

function pageParams(query, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

function parseTypes(raw) {
  if (!raw) return STAY_TYPE_KEYS;
  const list = String(raw)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => STAY_TYPES[t]);
  return list.length ? list : STAY_TYPE_KEYS;
}

function parseBookingTypes(raw) {
  if (!raw) return BOOKING_TYPE_KEYS;
  const list = String(raw)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    // motel bookings hotel collection me hi aati hain
    .map((t) => (t === "motel" ? "hotel" : t))
    .filter((t) => BOOKING_TYPES[t]);
  return list.length ? [...new Set(list)] : BOOKING_TYPE_KEYS;
}

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

function dateRange(from, to) {
  const range = {};
  if (from) {
    const f = new Date(from);
    if (!isNaN(f)) range.$gte = startOfDay(f);
  }
  if (to) {
    const t = new Date(to);
    if (!isNaN(t)) range.$lt = addDays(startOfDay(t), 1); // `to` inclusive
  }
  return Object.keys(range).length ? range : null;
}

function searchClause(fields, term) {
  if (!term || !String(term).trim()) return null;
  const rx = new RegExp(escapeRegex(String(term).trim()), "i");
  return { $or: fields.map((f) => ({ [f]: rx })) };
}

const and = (...clauses) => {
  const list = clauses.filter((c) => c && Object.keys(c).length);
  if (!list.length) return {};
  return list.length === 1 ? list[0] : { $and: list };
};

/** Vendor docs -> { [id]: vendor } (sirf kaam ke fields) */
async function loadVendorMap(ids) {
  const clean = [...new Set(ids.filter(Boolean).map(String))].filter(isId);
  if (!clean.length) return {};
  const vendors = await StaysVendor.find({ _id: { $in: clean } })
    .select("name email phone businessName companyName kycStatus status isApproved profileImage")
    .lean();
  return Object.fromEntries(vendors.map((v) => [String(v._id), v]));
}

/** type -> { propertyId: { id, name, city, type } } for bookings etc. */
async function loadPropertyMap(entries) {
  // entries: [{ type, ids }]
  const map = {};
  await Promise.all(
    entries.map(async ({ type, ids }) => {
      const clean = [...new Set(ids.filter(Boolean).map(String))].filter(isId);
      if (!clean.length) return;
      const cfg = STAY_TYPES[type];
      const docs = await cfg.model.find({ _id: { $in: clean } }).select("-password").lean();
      docs.forEach((d) => {
        map[String(d._id)] = {
          id: String(d._id),
          type,
          name: cfg.nameOf(d),
          city: cfg.cityOf(d) || "",
        };
      });
    })
  );
  return map;
}

/** Vendor ke private/sensitive fields hata do */
function cleanVendor(v) {
  if (!v) return v;
  const { password, otp, otpExpiry, resetPasswordToken, resetPasswordExpire, refreshToken, ...rest } = v;
  return rest;
}

function cleanProperty(d) {
  if (!d) return d;
  const { password, ...rest } = d;
  return rest;
}

function adminIdOf(req) {
  return req.admin?._id || req.admin?.id || req.user?._id || req.user?.id || null;
}

/* ============================================================
   INVENTORY / ROOM CONFIG (type -> vendor ke collections)
============================================================ */

const INVENTORY = {
  hotel: {
    model: StaysHotelInventory,
    propertyField: "hotel",
    total: "totalRooms",
    avail: "availableRooms",
    booked: "bookedRooms",
    blocked: "blockedRooms",
    stopExpr: { $eq: ["$stopSell", true] },
  },
  homestay: {
    model: StaysHomestayInventory,
    propertyField: "homestay",
    total: "totalUnits",
    avail: "availableUnits",
    booked: "bookedUnits",
    blocked: "blockedUnits",
    stopExpr: { $or: [{ $eq: ["$stopSell", true] }, { $eq: ["$closedForBooking", true] }] },
  },
  apartment: {
    model: StaysApartmentInventory,
    propertyField: "apartment",
    total: "totalUnits",
    avail: "availableUnits",
    booked: "bookedUnits",
    blocked: "blockedUnits",
    stopExpr: { $in: ["$status", ["BLOCKED", "SOLD_OUT"]] },
  },
  palace: {
    model: StaysPalaceInventory,
    propertyField: "palace",
    total: "totalRooms",
    avail: "availableRooms",
    booked: "bookedRooms",
    blocked: "blockedRooms",
    stopExpr: { $eq: ["$stopSell", true] },
  },
  resort: {
    model: StaysResortInventory,
    propertyField: "resort",
    total: "totalRooms",
    avail: "availableRooms",
    booked: "bookedRooms",
    blocked: "blockedRooms",
    stopExpr: { $eq: ["$status", "BLOCKED"] },
  },
};
INVENTORY.motel = INVENTORY.hotel;

const ROOMS = {
  hotel: { model: StaysHotelRoom, propertyField: "hotel" },
  homestay: { model: StaysHomestayUnit, propertyField: "homestay" },
  palace: {
    model: StaysPalaceRoomCategory,
    propertyField: "palace",
    units: { model: StaysPalaceRoomUnit, propertyField: "palace", groupField: "roomCategory" },
  },
  resort: {
    model: StaysResortRoom,
    propertyField: "resort",
    units: { model: StaysResortRoomUnit, propertyField: "resort", groupField: "roomCategory" },
  },
};
ROOMS.motel = ROOMS.hotel;

const RATE_PLANS = {
  apartment: { model: StaysApartmentRatePlan, propertyField: "apartment" },
  palace: { model: StaysPalaceRatePlan, propertyField: "palace" },
  resort: { model: StaysResortRatePlan, propertyField: "resort" },
};

const REVIEWS = {
  homestay: { model: StaysHomestayReview, propertyField: "homestay", ratingField: "overallRating" },
  resort: { model: StaysResortReview, propertyField: "resort", ratingField: "rating" },
};

const BOOKING_NOT_REVENUE = ["CANCELLED", "REJECTED", "NO_SHOW"];

/** Type ke hisaab se status -> counts */
async function statusBreakdown(type) {
  const cfg = STAY_TYPES[type];
  const rows = await cfg.model.aggregate([
    { $match: cfg.baseFilter },
    {
      $group: {
        _id: { s: "$status", a: "$isActive", ap: "$isApproved" },
        n: { $sum: 1 },
      },
    },
  ]);

  const out = Object.fromEntries(STAY_STATUSES.map((s) => [s, 0]));
  let total = 0;
  rows.forEach((r) => {
    const status = normalizeStatus(type, {
      status: r._id.s,
      isActive: r._id.a,
      isApproved: r._id.ap,
    });
    out[status] = (out[status] || 0) + r.n;
    total += r.n;
  });
  out.TOTAL = total;
  return out;
}

/* ============================================================
   GET /meta
   Frontend dropdown / tabs ke liye config
============================================================ */

export const getMeta = handle(async (_req, res) => {
  sendOk(res, {
    types: STAY_TYPE_KEYS.map((key) => ({
      key,
      label: STAY_TYPES[key].label,
      hasRooms: !!ROOMS[key],
      hasInventory: !!INVENTORY[key],
      hasRatePlans: !!RATE_PLANS[key],
      hasReviews: !!REVIEWS[key],
      hasBookings: !!BOOKING_TYPES[key === "motel" ? "hotel" : key],
    })),
    statuses: STAY_STATUSES,
    actions: ["approve", "reject", "suspend", "reactivate"],
    bookingStatuses: [
      "PENDING",
      "CONFIRMED",
      "CHECKED_IN",
      "CHECKED_OUT",
      "COMPLETED",
      "CANCELLED",
      "REJECTED",
      "NO_SHOW",
    ],
  });
});

/* ============================================================
   GET /dashboard
   "Stays · Overview" page ke saare numbers
============================================================ */

export const getDashboard = handle(async (_req, res) => {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekAgo = addDays(now, -7);
  const twoWeeksAgo = addDays(now, -14);
  const next7 = addDays(today, 7);

  // ---------- 1. Property counts by type & status ----------
  const breakdownList = await Promise.all(STAY_TYPE_KEYS.map(statusBreakdown));
  const byType = {};
  const totals = Object.fromEntries(STAY_STATUSES.map((s) => [s, 0]));
  totals.TOTAL = 0;

  STAY_TYPE_KEYS.forEach((type, i) => {
    byType[type] = { label: STAY_TYPES[type].label, ...breakdownList[i] };
    Object.keys(totals).forEach((k) => {
      totals[k] += breakdownList[i][k] || 0;
    });
  });

  // ---------- 2. Bookings (today / week / WoW) ----------
  const bookingStats = await Promise.all(
    BOOKING_TYPE_KEYS.map(async (type) => {
      const cfg = BOOKING_TYPES[type];
      const amountExpr = `$${cfg.amountField}`;
      const statusExpr = `$${cfg.statusField}`;

      const [todayRows, thisWeek, prevWeek, arrivals] = await Promise.all([
        cfg.model.aggregate([
          { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: statusExpr, n: { $sum: 1 } } },
        ]),
        cfg.model.aggregate([
          { $match: { createdAt: { $gte: weekAgo, $lte: now }, [cfg.statusField]: { $nin: BOOKING_NOT_REVENUE } } },
          { $group: { _id: null, gross: { $sum: amountExpr }, n: { $sum: 1 } } },
        ]),
        cfg.model.aggregate([
          { $match: { createdAt: { $gte: twoWeeksAgo, $lt: weekAgo }, [cfg.statusField]: { $nin: BOOKING_NOT_REVENUE } } },
          { $group: { _id: null, gross: { $sum: amountExpr } } },
        ]),
        cfg.model.aggregate([
          {
            $match: {
              [cfg.checkInField]: { $gte: today, $lt: tomorrow },
              [cfg.statusField]: { $in: ["PENDING", "CONFIRMED"] },
            },
          },
          { $group: { _id: `$${cfg.paymentStatusField}`, n: { $sum: 1 } } },
        ]),
      ]);

      return { type, todayRows, thisWeek: thisWeek[0], prevWeek: prevWeek[0], arrivals };
    })
  );

  let bookingsToday = 0;
  let confirmedToday = 0;
  let grossThisWeek = 0;
  let grossPrevWeek = 0;
  let arrivalsToday = 0;
  let arrivalsAttention = 0;

  bookingStats.forEach((b) => {
    b.todayRows.forEach((r) => {
      bookingsToday += r.n;
      if (["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED"].includes(String(r._id).toUpperCase())) {
        confirmedToday += r.n;
      }
    });
    grossThisWeek += b.thisWeek?.gross || 0;
    grossPrevWeek += b.prevWeek?.gross || 0;
    b.arrivals.forEach((r) => {
      arrivalsToday += r.n;
      if (String(r._id).toUpperCase() !== "PAID") arrivalsAttention += r.n;
    });
  });

  const wow = grossPrevWeek > 0 ? ((grossThisWeek - grossPrevWeek) / grossPrevWeek) * 100 : null;

  // ---------- 3. Sellability: aaj + agle 7 din ----------
  const sellRows = await Promise.all(
    Object.entries(INVENTORY)
      .filter(([k]) => k !== "motel")
      .map(async ([type, inv]) => {
        const rows = await inv.model.aggregate([
          { $match: { date: { $gte: today, $lt: next7 } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
              total: { $sum: { $ifNull: [`$${inv.total}`, 0] } },
              sellable: {
                $sum: {
                  $cond: [inv.stopExpr, 0, { $max: [{ $ifNull: [`$${inv.avail}`, 0] }, 0] }],
                },
              },
            },
          },
        ]);
        return { type, rows };
      })
  );

  const dayMap = {};
  sellRows.forEach(({ rows }) =>
    rows.forEach((r) => {
      dayMap[r._id] ||= { total: 0, sellable: 0 };
      dayMap[r._id].total += r.total;
      dayMap[r._id].sellable += r.sellable;
    })
  );

  const sellability = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const key = d.toISOString().slice(0, 10);
    const row = dayMap[key] || { total: 0, sellable: 0 };
    return {
      date: key,
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      total: row.total,
      sellable: row.sellable,
      percent: row.total ? Math.round((row.sellable / row.total) * 100) : null,
    };
  });

  const todayRow = sellability[0];

  // ---------- 4. Funnel (Application -> KYC -> Content -> Go-live) ----------
  const stayVendorFilter = await stayVendorQuery();
  const [applications, kycPending] = await Promise.all([
    StaysVendor.countDocuments(and(stayVendorFilter, { status: "PENDING" })),
    StaysVendor.countDocuments(
      and(stayVendorFilter, {
        kycStatus: { $in: ["not_started", "pending", "under_review", "additional_information_required"] },
      })
    ),
  ]);

  const funnel = [
    { key: "application", label: "Application", count: applications },
    { key: "kyc", label: "KYC / bank", count: kycPending },
    { key: "content", label: "Content & rooms", count: totals.DRAFT },
    { key: "golive", label: "Go-live review", count: totals.PENDING },
  ];

  // ---------- 5. Unmapped (approved but no rooms/rates) + readiness ----------
  const unmapped = await countUnmapped();
  const readiness = await roomReadiness();

  // ---------- 6. Overbooking + alert cards ----------
  const overbooking = await findOverbooking({ limit: 5 });

  const [latestPending, nextArrival] = await Promise.all([
    latestPendingProperty(),
    latestArrival(today, tomorrow),
  ]);

  const alerts = [];
  if (nextArrival) alerts.push({ tone: "arriving", ...nextArrival });
  if (latestPending) alerts.push({ tone: "review", ...latestPending });
  if (overbooking.total > 0) {
    const first = overbooking.rows[0];
    alerts.push({
      tone: "warning",
      code: `INV-${String(first.id).slice(-3).toUpperCase()}`,
      title: `${overbooking.total} overbooked date${overbooking.total > 1 ? "s" : ""}`,
      subtitle: first.propertyName || first.type,
      type: first.type,
      propertyId: first.propertyId,
    });
  }

  sendOk(res, {
    kpis: {
      liveProperties: totals.APPROVED,
      awaitingGoLive: totals.PENDING,
      totalProperties: totals.TOTAL,
      bookingsToday,
      confirmedPercentToday: bookingsToday ? Math.round((confirmedToday / bookingsToday) * 1000) / 10 : 0,
      sellableUnits: todayRow.sellable,
      sellablePercent: todayRow.percent,
      grossValue7d: grossThisWeek,
      grossValueWoWPercent: wow === null ? null : Math.round(wow * 10) / 10,
    },
    byType,
    statusTotals: totals,
    funnel,
    sellability,
    operations: {
      arrivalsToday,
      arrivalsNeedingAttention: arrivalsAttention,
      roomReadinessPercent: readiness.percent,
      roomsNotReady: readiness.open,
      unmappedProperties: unmapped,
    },
    alerts,
    generatedAt: now.toISOString(),
  });
});

async function countUnmapped() {
  // approved property jiske paas koi room/unit/category nahi
  const checks = [
    { type: "hotel", rooms: StaysHotelRoom, field: "hotel", embedded: true },
    { type: "motel", rooms: StaysHotelRoom, field: "hotel", embedded: true },
    { type: "homestay", rooms: StaysHomestayUnit, field: "homestay" },
    { type: "palace", rooms: StaysPalaceRoomCategory, field: "palace" },
    { type: "resort", rooms: StaysResortRoom, field: "resort" },
  ];

  const counts = await Promise.all(
    checks.map(async (c) => {
      const cfg = STAY_TYPES[c.type];
      const withRooms = await c.rooms.distinct(c.field);
      const filter = and(
        cfg.baseFilter,
        buildStatusFilter(c.type, "APPROVED"),
        { _id: { $nin: withRooms } },
        c.embedded ? { $or: [{ rooms: { $exists: false } }, { rooms: { $size: 0 } }] } : null
      );
      return cfg.model.countDocuments(filter);
    })
  );
  return counts.reduce((a, b) => a + b, 0);
}

async function roomReadiness() {
  const rows = await Promise.all(
    [StaysPalaceRoomUnit, StaysResortRoomUnit].map((m) =>
      m.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])
    )
  );
  let total = 0;
  let open = 0;
  rows.flat().forEach((r) => {
    total += r.n;
    if (["MAINTENANCE", "CLEANING", "OUT_OF_SERVICE", "BLOCKED"].includes(String(r._id).toUpperCase())) {
      open += r.n;
    }
  });
  return { total, open, percent: total ? Math.round(((total - open) / total) * 100) : null };
}

async function latestPendingProperty() {
  const rows = await Promise.all(
    STAY_TYPE_KEYS.map(async (type) => {
      const cfg = STAY_TYPES[type];
      const d = await cfg.model
        .findOne(and(cfg.baseFilter, buildStatusFilter(type, "PENDING")))
        .select("-password")
        .sort({ createdAt: -1 })
        .lean();
      return d ? { type, d } : null;
    })
  );
  const latest = rows
    .filter(Boolean)
    .sort((a, b) => new Date(b.d.createdAt || 0) - new Date(a.d.createdAt || 0))[0];
  if (!latest) return null;
  const cfg = STAY_TYPES[latest.type];
  return {
    code: `${latest.type.slice(0, 3).toUpperCase()}-${String(latest.d._id).slice(-3).toUpperCase()}`,
    title: cfg.nameOf(latest.d),
    subtitle: `${cfg.label} · awaiting approval`,
    type: latest.type,
    propertyId: String(latest.d._id),
  };
}

async function latestArrival(today, tomorrow) {
  for (const type of BOOKING_TYPE_KEYS) {
    const cfg = BOOKING_TYPES[type];
    const b = await cfg.model
      .findOne({ [cfg.checkInField]: { $gte: today, $lt: tomorrow }, [cfg.statusField]: { $in: ["PENDING", "CONFIRMED"] } })
      .sort({ createdAt: -1 })
      .lean();
    if (b) {
      const map = await loadPropertyMap([{ type, ids: [b[cfg.propertyField]] }]);
      const prop = map[String(b[cfg.propertyField])];
      return {
        code: `STY-${String(b._id).slice(-4).toUpperCase()}`,
        title: prop?.name || "Arrival",
        subtitle: `${cfg.refOf(b) || "booking"} · arriving today`,
        type,
        propertyId: prop?.id || null,
      };
    }
  }
  return null;
}

/* ============================================================
   GET /properties
   Saare types ki unified list (filter + search + pagination)

   Query: type=hotel,motel  status=PENDING  city=  vendor=<id>
          q=search  featured=true  page  limit  sort=newest|oldest
============================================================ */

export const listProperties = handle(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const types = parseTypes(req.query.type);
  const sortDir = req.query.sort === "oldest" ? 1 : -1;
  const { status, city, vendor, q, featured } = req.query;

  // har type ke liye filter bana ke parallel fetch
  const perType = await Promise.all(
    types.map(async (type) => {
      const cfg = STAY_TYPES[type];

      const baseWithoutStatus = and(
        cfg.baseFilter,
        city ? { [cfg.cityField]: new RegExp(`^${escapeRegex(city)}$`, "i") } : null,
        vendor && isId(vendor) ? { [cfg.vendorField]: new mongoose.Types.ObjectId(vendor) } : null,
        featured === "true" ? { [cfg.featuredField || "featured"]: true } : null,
        searchClause(cfg.searchFields, q)
      );

      const filter = and(baseWithoutStatus, buildStatusFilter(type, status));

      const [docs, total] = await Promise.all([
        cfg.model
          .find(filter)
          .select("-password")
          .sort({ createdAt: sortDir })
          .limit(skip + limit) // merge ke liye itna kaafi hai
          .lean(),
        cfg.model.countDocuments(filter),
      ]);

      return { type, docs, total };
    })
  );

  const merged = perType
    .flatMap(({ type, docs }) => docs.map((d) => ({ type, d })))
    .sort((a, b) => {
      const diff = new Date(a.d.createdAt || 0) - new Date(b.d.createdAt || 0);
      return sortDir === 1 ? diff : -diff;
    })
    .slice(skip, skip + limit);

  const vendorMap = await loadVendorMap(
    merged.map(({ type, d }) => d[STAY_TYPES[type].vendorField])
  );

  const items = merged.map(({ type, d }) => summarizeStay(type, d, vendorMap));
  const total = perType.reduce((sum, t) => sum + t.total, 0);

  sendOk(res, items, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    byType: Object.fromEntries(perType.map((t) => [t.type, t.total])),
  });
});

/* ============================================================
   GET /properties/:type/:id
   Property 360: vendor ka poora data + rooms + rates + inventory +
   bookings + reviews
============================================================ */

export const getPropertyDetail = handle(async (req, res) => {
  const { type, id } = req.params;
  const cfg = STAY_TYPES[type];
  if (!cfg) return sendErr(res, 400, "INVALID_TYPE", `Unknown stay type: ${type}`);
  if (!isId(id)) return sendErr(res, 400, "INVALID_ID", "Invalid property id");

  const doc = await cfg.model.findById(id).select("-password").lean();
  if (!doc) return sendErr(res, 404, "NOT_FOUND", `${cfg.label} not found`);

  const vendorId = doc[cfg.vendorField];
  const vendorDoc = vendorId && isId(vendorId) ? await StaysVendor.findById(vendorId).lean() : null;

  const bookingType = type === "motel" ? "hotel" : type;
  const bcfg = BOOKING_TYPES[bookingType];
  const inv = INVENTORY[type];
  const roomCfg = ROOMS[type];
  const rateCfg = RATE_PLANS[type];
  const reviewCfg = REVIEWS[type];
  const today = startOfDay();

  const [rooms, units, ratePlans, inventory, recentBookings, bookingAgg, reviews] = await Promise.all([
    roomCfg ? roomCfg.model.find({ [roomCfg.propertyField]: id }).sort({ createdAt: -1 }).limit(200).lean() : [],
    roomCfg?.units
      ? roomCfg.units.model.find({ [roomCfg.units.propertyField]: id }).limit(500).lean()
      : [],
    rateCfg ? rateCfg.model.find({ [rateCfg.propertyField]: id }).sort({ createdAt: -1 }).limit(100).lean() : [],
    inv
      ? inv.model
          .find({ [inv.propertyField]: id, date: { $gte: today, $lt: addDays(today, 14) } })
          .sort({ date: 1 })
          .limit(300)
          .lean()
      : [],
    bcfg
      ? bcfg.model.find({ [bcfg.propertyField]: id }).sort({ createdAt: -1 }).limit(10).lean()
      : [],
    bcfg
      ? bcfg.model.aggregate([
          { $match: { [bcfg.propertyField]: new mongoose.Types.ObjectId(id) } },
          {
            $group: {
              _id: `$${bcfg.statusField}`,
              n: { $sum: 1 },
              amount: { $sum: `$${bcfg.amountField}` },
            },
          },
        ])
      : [],
    reviewCfg
      ? reviewCfg.model.find({ [reviewCfg.propertyField]: id }).sort({ createdAt: -1 }).limit(10).lean()
      : [],
  ]);

  const bookingSummary = { total: 0, byStatus: {}, grossValue: 0 };
  bookingAgg.forEach((r) => {
    const s = String(r._id).toUpperCase();
    bookingSummary.total += r.n;
    bookingSummary.byStatus[s] = r.n;
    if (!BOOKING_NOT_REVENUE.includes(s)) bookingSummary.grossValue += r.amount || 0;
  });

  // BnB ke rooms embedded hote hain
  const embeddedRooms = type === "bnb" ? doc.roomTypes || [] : type === "hotel" || type === "motel" ? doc.rooms || [] : [];

  sendOk(res, {
    summary: summarizeStay(type, doc, vendorId ? { [String(vendorId)]: vendorDoc || {} } : {}),
    property: cleanProperty(doc), // vendor ka poora raw data (saari fields)
    vendor: cleanVendor(vendorDoc),
    rooms,
    roomUnits: units,
    embeddedRooms,
    ratePlans,
    inventory,
    bookings: {
      summary: bookingSummary,
      recent: bcfg ? recentBookings.map((b) => summarizeBooking(bookingType, b, { [id]: { id, type, name: cfg.nameOf(doc), city: cfg.cityOf(doc) } })) : [],
    },
    reviews,
  });
});

/* ============================================================
   PATCH /properties/:type/:id/status     body: { action, reason? }
   action: approve | reject | suspend | reactivate
============================================================ */

async function applyAction(req, res, action) {
  const { type, id } = req.params;
  const cfg = STAY_TYPES[type];
  if (!cfg) return sendErr(res, 400, "INVALID_TYPE", `Unknown stay type: ${type}`);
  if (!isId(id)) return sendErr(res, 400, "INVALID_ID", "Invalid property id");

  const reason = String(req.body?.reason || "").trim();
  if (action === "reject" && !reason) {
    return sendErr(res, 400, "REASON_REQUIRED", "Rejection reason is required");
  }

  const adminId = adminIdOf(req);
  const patch = buildStatusPatch(type, action, { reason, adminId });
  if (!patch) return sendErr(res, 400, "INVALID_ACTION", `Unknown action: ${action}`);

  const before = await cfg.model.findById(id).select("-password").lean();
  if (!before) return sendErr(res, 404, "NOT_FOUND", `${cfg.label} not found`);

  const updated = await cfg.model
    .findByIdAndUpdate(
      id,
      {
        $set: patch,
        $push: {
          adminAuditLog: {
            action,
            reason,
            by: adminId && isId(adminId) ? adminId : null,
            from: normalizeStatus(type, before),
            at: new Date(),
          },
        },
      },
      { new: true, strict: false }
    )
    .select("-password")
    .lean();

  const vendorMap = await loadVendorMap([updated[cfg.vendorField]]);
  sendOk(res, summarizeStay(type, updated, vendorMap));
}

export const changeStatus = handle((req, res) => applyAction(req, res, String(req.body?.action || "").toLowerCase()));
export const approveProperty = handle((req, res) => applyAction(req, res, "approve"));
export const rejectProperty = handle((req, res) => applyAction(req, res, "reject"));
export const suspendProperty = handle((req, res) => applyAction(req, res, "suspend"));
export const reactivateProperty = handle((req, res) => applyAction(req, res, "reactivate"));

/** PATCH /properties/:type/:id/feature   body: { featured: true|false } */
export const setFeatured = handle(async (req, res) => {
  const { type, id } = req.params;
  const cfg = STAY_TYPES[type];
  if (!cfg) return sendErr(res, 400, "INVALID_TYPE", `Unknown stay type: ${type}`);
  if (!isId(id)) return sendErr(res, 400, "INVALID_ID", "Invalid property id");

  const featured = req.body?.featured !== false && req.body?.featured !== "false";
  const field = cfg.featuredField || "featured";

  const updated = await cfg.model
    .findByIdAndUpdate(id, { $set: { [field]: featured } }, { new: true, strict: false })
    .select("-password")
    .lean();
  if (!updated) return sendErr(res, 404, "NOT_FOUND", `${cfg.label} not found`);

  sendOk(res, summarizeStay(type, updated, {}));
});

/* ============================================================
   GET /rooms?type=&propertyId=&status=&page=&limit=
   Hotel rooms, Homestay units, Palace/Resort categories (+ units),
   Apartment rate plans, BnB room types
============================================================ */

export const listRooms = handle(async (req, res) => {
  const { type = "hotel", propertyId, status } = req.query;
  const { page, limit, skip } = pageParams(req.query, 25, 200);

  if (!STAY_TYPES[type]) return sendErr(res, 400, "INVALID_TYPE", `Unknown stay type: ${type}`);

  // BnB: embedded
  if (type === "bnb") {
    const filter = propertyId && isId(propertyId) ? { _id: propertyId } : {};
    const props = await STAY_TYPES.bnb.model.find(filter).select("propertyName roomTypes").limit(limit).skip(skip).lean();
    const rooms = props.flatMap((p) =>
      (p.roomTypes || []).map((r) => ({ ...r, propertyId: String(p._id), propertyName: p.propertyName }))
    );
    return sendOk(res, rooms, { page, limit, total: rooms.length });
  }

  // Apartment: apartment khud unit hai, rate plans dikhao
  if (type === "apartment") {
    const filter = propertyId && isId(propertyId) ? { apartment: propertyId } : {};
    const [rows, total] = await Promise.all([
      StaysApartmentRatePlan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      StaysApartmentRatePlan.countDocuments(filter),
    ]);
    return sendOk(res, rows, { page, limit, total, note: "Apartment me apartment hi sellable unit hai; yahan rate plans hain" });
  }

  const cfg = ROOMS[type];
  if (!cfg) return sendOk(res, [], { page, limit, total: 0 });

  const filter = and(
    propertyId && isId(propertyId) ? { [cfg.propertyField]: propertyId } : null,
    status ? { status: new RegExp(`^${escapeRegex(status)}$`, "i") } : null
  );

  const [rows, total] = await Promise.all([
    cfg.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    cfg.model.countDocuments(filter),
  ]);

  // property ka naam saath me
  const propMap = await loadPropertyMap([{ type, ids: rows.map((r) => r[cfg.propertyField]) }]);
  const data = rows.map((r) => ({
    ...r,
    property: propMap[String(r[cfg.propertyField])] || null,
  }));

  sendOk(res, data, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
});

/* ============================================================
   GET /rates?type=&propertyId=     (rate plans: apartment/palace/resort)
============================================================ */

export const listRatePlans = handle(async (req, res) => {
  const { type = "palace", propertyId } = req.query;
  const cfg = RATE_PLANS[type];
  if (!cfg) return sendErr(res, 400, "NO_RATE_PLANS", "Rate plans sirf apartment, palace, resort me hote hain");

  const { page, limit, skip } = pageParams(req.query, 25, 200);
  const filter = propertyId && isId(propertyId) ? { [cfg.propertyField]: propertyId } : {};

  const [rows, total] = await Promise.all([
    cfg.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    cfg.model.countDocuments(filter),
  ]);

  sendOk(res, rows, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
});

/* ============================================================
   GET /inventory?type=&propertyId=&from=&to=
============================================================ */

export const listInventory = handle(async (req, res) => {
  const { type = "hotel", propertyId, from, to } = req.query;
  const inv = INVENTORY[type];
  if (!inv) return sendErr(res, 400, "NO_INVENTORY", `${type} me inventory calendar nahi hai`);

  const { page, limit, skip } = pageParams(req.query, 62, 500);
  const range = dateRange(from, to) || { $gte: startOfDay(), $lt: addDays(startOfDay(), 31) };

  const filter = and(
    { date: range },
    propertyId && isId(propertyId) ? { [inv.propertyField]: propertyId } : null
  );

  const [rows, total] = await Promise.all([
    inv.model.find(filter).sort({ date: 1 }).skip(skip).limit(limit).lean(),
    inv.model.countDocuments(filter),
  ]);

  sendOk(res, rows, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
});

/* ============================================================
   GET /overbooking   (booked + blocked > total)
============================================================ */

async function findOverbooking({ limit = 50, skip = 0 } = {}) {
  const today = startOfDay();
  const results = await Promise.all(
    Object.entries(INVENTORY)
      .filter(([k]) => k !== "motel")
      .map(async ([type, inv]) => {
        const filter = {
          date: { $gte: today },
          $expr: {
            $or: [
              {
                $gt: [
                  { $add: [{ $ifNull: [`$${inv.booked}`, 0] }, { $ifNull: [`$${inv.blocked}`, 0] }] },
                  { $ifNull: [`$${inv.total}`, 0] },
                ],
              },
              { $lt: [{ $ifNull: [`$${inv.avail}`, 0] }, 0] },
            ],
          },
        };
        const [rows, total] = await Promise.all([
          inv.model.find(filter).sort({ date: 1 }).limit(limit + skip).lean(),
          inv.model.countDocuments(filter),
        ]);
        return { type, inv, rows, total };
      })
  );

  const flat = results.flatMap(({ type, inv, rows }) =>
    rows.map((r) => ({
      id: String(r._id),
      type,
      propertyId: r[inv.propertyField] ? String(r[inv.propertyField]) : null,
      date: r.date,
      total: r[inv.total] ?? 0,
      booked: r[inv.booked] ?? 0,
      blocked: r[inv.blocked] ?? 0,
      available: r[inv.avail] ?? 0,
    }))
  );

  flat.sort((a, b) => new Date(a.date) - new Date(b.date));
  const page = flat.slice(skip, skip + limit);

  const propMap = await loadPropertyMap(
    [...new Set(page.map((r) => r.type))].map((type) => ({
      type,
      ids: page.filter((r) => r.type === type).map((r) => r.propertyId),
    }))
  );

  return {
    total: results.reduce((s, r) => s + r.total, 0),
    rows: page.map((r) => ({ ...r, propertyName: propMap[r.propertyId]?.name || null })),
  };
}

export const listOverbooking = handle(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 50, 200);
  const out = await findOverbooking({ limit, skip });
  sendOk(res, out.rows, { page, limit, total: out.total });
});

/* ============================================================
   GET /bookings
   Query: type, status, paymentStatus, propertyId, vendor, q,
          from, to, dateField=checkIn|created, page, limit
============================================================ */

export const listBookings = handle(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const types = parseBookingTypes(req.query.type);
  const { status, paymentStatus, propertyId, vendor, q, from, to } = req.query;
  const useCreated = req.query.dateField === "created";
  const range = dateRange(from, to);

  const perType = await Promise.all(
    types.map(async (type) => {
      const cfg = BOOKING_TYPES[type];
      const dateKey = useCreated ? "createdAt" : cfg.checkInField;

      const filter = and(
        status ? { [cfg.statusField]: String(status).toUpperCase() } : null,
        paymentStatus ? { [cfg.paymentStatusField]: String(paymentStatus).toUpperCase() } : null,
        propertyId && isId(propertyId) ? { [cfg.propertyField]: new mongoose.Types.ObjectId(propertyId) } : null,
        vendor && isId(vendor) ? { vendor: new mongoose.Types.ObjectId(vendor) } : null,
        range ? { [dateKey]: range } : null,
        searchClause(cfg.searchFields, q)
      );

      const [docs, total] = await Promise.all([
        cfg.model.find(filter).sort({ createdAt: -1 }).limit(skip + limit).lean(),
        cfg.model.countDocuments(filter),
      ]);
      return { type, docs, total };
    })
  );

  const merged = perType
    .flatMap(({ type, docs }) => docs.map((d) => ({ type, d })))
    .sort((a, b) => new Date(b.d.createdAt || 0) - new Date(a.d.createdAt || 0))
    .slice(skip, skip + limit);

  const propMap = await loadPropertyMap(
    types.map((type) => ({
      type,
      ids: merged.filter((m) => m.type === type).map((m) => m.d[BOOKING_TYPES[type].propertyField]),
    }))
  );

  const items = merged.map(({ type, d }) => summarizeBooking(type, d, propMap));
  const total = perType.reduce((s, t) => s + t.total, 0);

  sendOk(res, items, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    byType: Object.fromEntries(perType.map((t) => [t.type, t.total])),
  });
});

/** GET /bookings/:type/:id */
export const getBookingDetail = handle(async (req, res) => {
  const type = req.params.type === "motel" ? "hotel" : req.params.type;
  const cfg = BOOKING_TYPES[type];
  if (!cfg) return sendErr(res, 400, "INVALID_TYPE", `Unknown booking type: ${req.params.type}`);
  if (!isId(req.params.id)) return sendErr(res, 400, "INVALID_ID", "Invalid booking id");

  const booking = await cfg.model.findById(req.params.id).lean();
  if (!booking) return sendErr(res, 404, "NOT_FOUND", "Booking not found");

  const propMap = await loadPropertyMap([{ type, ids: [booking[cfg.propertyField]] }]);
  const vendorMap = await loadVendorMap([booking.vendor]);

  sendOk(res, {
    summary: summarizeBooking(type, booking, propMap),
    booking, // vendor ka raw booking data
    vendor: vendorMap[String(booking.vendor)] || null,
  });
});

/* ============================================================
   REVIEWS (homestay + resort)
   GET   /reviews?type=homestay|resort&status=&propertyId=
   PATCH /reviews/:type/:id    body: { status, reason? }
============================================================ */

export const listReviews = handle(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const types = req.query.type ? [req.query.type] : Object.keys(REVIEWS);
  const { status, propertyId } = req.query;

  const invalid = types.find((t) => !REVIEWS[t]);
  if (invalid) return sendErr(res, 400, "INVALID_TYPE", "Reviews sirf homestay aur resort ke available hain");

  const perType = await Promise.all(
    types.map(async (type) => {
      const cfg = REVIEWS[type];
      const filter = and(
        status ? { status: String(status).toUpperCase() } : null,
        propertyId && isId(propertyId) ? { [cfg.propertyField]: propertyId } : null
      );
      const [docs, total] = await Promise.all([
        cfg.model.find(filter).sort({ createdAt: -1 }).limit(skip + limit).lean(),
        cfg.model.countDocuments(filter),
      ]);
      return { type, docs, total };
    })
  );

  const merged = perType
    .flatMap(({ type, docs }) => docs.map((d) => ({ type, d })))
    .sort((a, b) => new Date(b.d.createdAt || 0) - new Date(a.d.createdAt || 0))
    .slice(skip, skip + limit);

  const propMap = await loadPropertyMap(
    types.map((type) => ({
      type,
      ids: merged.filter((m) => m.type === type).map((m) => m.d[REVIEWS[type].propertyField]),
    }))
  );

  const items = merged.map(({ type, d }) => ({
    ...d,
    id: String(d._id),
    type,
    rating: d[REVIEWS[type].ratingField] ?? null,
    property: propMap[String(d[REVIEWS[type].propertyField])] || null,
  }));

  sendOk(res, items, {
    page,
    limit,
    total: perType.reduce((s, t) => s + t.total, 0),
  });
});

export const moderateReview = handle(async (req, res) => {
  const { type, id } = req.params;
  const cfg = REVIEWS[type];
  if (!cfg) return sendErr(res, 400, "INVALID_TYPE", "Reviews sirf homestay aur resort ke available hain");
  if (!isId(id)) return sendErr(res, 400, "INVALID_ID", "Invalid review id");

  const status = String(req.body?.status || "").toUpperCase();
  if (!["PENDING", "APPROVED", "REJECTED", "HIDDEN"].includes(status)) {
    return sendErr(res, 400, "INVALID_STATUS", "status must be PENDING, APPROVED, REJECTED or HIDDEN");
  }

  const adminId = adminIdOf(req);
  const patch = {
    status,
    rejectionReason: status === "REJECTED" ? String(req.body?.reason || "") : "",
    moderatedAt: new Date(),
    ...(adminId && isId(adminId) ? { moderatedBy: adminId } : {}),
  };

  const updated = await cfg.model
    .findByIdAndUpdate(id, { $set: patch }, { new: true, strict: false })
    .lean();
  if (!updated) return sendErr(res, 404, "NOT_FOUND", "Review not found");

  sendOk(res, updated);
});

/* ============================================================
   VENDORS (Vendor 360, onboarding & KYC, applications)
============================================================ */

/** Stays se related vendors ka filter */
async function stayVendorQuery() {
  const idLists = await Promise.all(
    STAY_TYPE_KEYS.map((t) => STAY_TYPES[t].model.distinct(STAY_TYPES[t].vendorField))
  );
  const ids = [...new Set(idLists.flat().filter(Boolean).map(String))].filter(isId);

  return {
    $or: [
      { _id: { $in: ids } },
      { serviceTypes: { $in: [/stay/i, /hotel/i, /motel/i, /homestay/i, /apartment/i, /villa/i, /palace/i, /resort/i, /bnb/i] } },
    ],
  };
}

/** GET /vendors?q=&kycStatus=&status=&page=&limit= */
export const listVendors = handle(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const { q, kycStatus, status } = req.query;

  const base = await stayVendorQuery();
  const filter = and(
    base,
    kycStatus ? { kycStatus } : null,
    status ? { status: String(status).toUpperCase() } : null,
    searchClause(["name", "email", "phone", "businessName", "companyName"], q)
  );

  const [vendors, total] = await Promise.all([
    StaysVendor.find(filter)
      .select("name email phone businessName companyName kycStatus status isApproved profileImage createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StaysVendor.countDocuments(filter),
  ]);

  // har vendor ki property counts
  const ids = vendors.map((v) => v._id);
  const counts = await Promise.all(
    STAY_TYPE_KEYS.map(async (type) => {
      const cfg = STAY_TYPES[type];
      const rows = await cfg.model.aggregate([
        { $match: and(cfg.baseFilter, { [cfg.vendorField]: { $in: ids } }) },
        { $group: { _id: `$${cfg.vendorField}`, n: { $sum: 1 } } },
      ]);
      return { type, rows };
    })
  );

  const countMap = {};
  counts.forEach(({ type, rows }) =>
    rows.forEach((r) => {
      const key = String(r._id);
      countMap[key] ||= { total: 0 };
      countMap[key][type] = r.n;
      countMap[key].total += r.n;
    })
  );

  const data = vendors.map((v) => ({
    ...v,
    id: String(v._id),
    properties: countMap[String(v._id)] || { total: 0 },
  }));

  sendOk(res, data, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
});

/** GET /vendors/:vendorId  -> Vendor 360 */
export const getVendorDetail = handle(async (req, res) => {
  const { vendorId } = req.params;
  if (!isId(vendorId)) return sendErr(res, 400, "INVALID_ID", "Invalid vendor id");

  const vendor = await StaysVendor.findById(vendorId).lean();
  if (!vendor) return sendErr(res, 404, "NOT_FOUND", "Vendor not found");

  const vid = new mongoose.Types.ObjectId(vendorId);

  const [propertyLists, bookingAggs] = await Promise.all([
    Promise.all(
      STAY_TYPE_KEYS.map(async (type) => {
        const cfg = STAY_TYPES[type];
        const docs = await cfg.model
          .find(and(cfg.baseFilter, { [cfg.vendorField]: vid }))
          .select("-password")
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
        return docs.map((d) => summarizeStay(type, d, { [vendorId]: vendor }));
      })
    ),
    Promise.all(
      BOOKING_TYPE_KEYS.map(async (type) => {
        const cfg = BOOKING_TYPES[type];
        const rows = await cfg.model.aggregate([
          { $match: { vendor: vid } },
          {
            $group: {
              _id: `$${cfg.statusField}`,
              n: { $sum: 1 },
              amount: { $sum: `$${cfg.amountField}` },
            },
          },
        ]);
        return { type, rows };
      })
    ),
  ]);

  const properties = propertyLists.flat();
  const bookings = { total: 0, grossValue: 0, byType: {} };
  bookingAggs.forEach(({ type, rows }) => {
    bookings.byType[type] = { count: 0, grossValue: 0 };
    rows.forEach((r) => {
      const s = String(r._id).toUpperCase();
      bookings.byType[type].count += r.n;
      bookings.total += r.n;
      if (!BOOKING_NOT_REVENUE.includes(s)) {
        bookings.byType[type].grossValue += r.amount || 0;
        bookings.grossValue += r.amount || 0;
      }
    });
  });

  sendOk(res, {
    vendor: cleanVendor(vendor),
    properties,
    propertyCounts: properties.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {}),
    bookings,
  });
});

/** GET /vendor-applications?kycStatus=&status=  (onboarding & KYC queue) */
export const listVendorApplications = handle(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const base = await stayVendorQuery();

  const filter = and(
    base,
    req.query.status
      ? { status: String(req.query.status).toUpperCase() }
      : { $or: [{ status: "PENDING" }, { kycStatus: { $in: ["pending", "under_review", "additional_information_required"] } }] },
    req.query.kycStatus ? { kycStatus: req.query.kycStatus } : null,
    searchClause(["name", "email", "phone", "businessName", "companyName"], req.query.q)
  );

  const [rows, total] = await Promise.all([
    StaysVendor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    StaysVendor.countDocuments(filter),
  ]);

  sendOk(res, rows.map(cleanVendor), { page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
});

/** GET /motel-operators  (admin ne jo motel vendor profiles add kiye hain) */
export const listMotelOperators = handle(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const filter = and(
    req.query.approved === "true" ? { isApproved: true } : req.query.approved === "false" ? { isApproved: false } : null,
    searchClause(["ownerName", "companyName", "email", "phone", "city"], req.query.q)
  );

  const [rows, total] = await Promise.all([
    StaysMotelOperator.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    StaysMotelOperator.countDocuments(filter),
  ]);

  sendOk(res, rows, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
});

/* ============================================================
   GET /payouts   (Payment & payouts / Commercial & settlement)
   Query: from, to, vendor
============================================================ */

export const getPayouts = handle(async (req, res) => {
  const range = dateRange(req.query.from, req.query.to);
  const vendor = req.query.vendor && isId(req.query.vendor) ? new mongoose.Types.ObjectId(req.query.vendor) : null;

  const baseMatch = (extra = {}) => and(range ? { createdAt: range } : null, vendor ? { vendor } : null, extra);

  // payment status wise gross (sab 5 booking types)
  const payments = await Promise.all(
    BOOKING_TYPE_KEYS.map(async (type) => {
      const cfg = BOOKING_TYPES[type];
      const rows = await cfg.model.aggregate([
        { $match: baseMatch() },
        { $group: { _id: `$${cfg.paymentStatusField}`, n: { $sum: 1 }, amount: { $sum: `$${cfg.amountField}` } } },
      ]);
      return {
        type,
        rows: rows.map((r) => ({ paymentStatus: String(r._id || "UNKNOWN").toUpperCase(), count: r.n, amount: r.amount })),
      };
    })
  );

  // settlement (sirf hotel + homestay me commission/settlement fields hain)
  const settlementTypes = ["hotel", "homestay"];
  const settlement = await Promise.all(
    settlementTypes.map(async (type) => {
      const cfg = BOOKING_TYPES[type];
      const commissionField = type === "hotel" ? "$adminCommission" : "$adminCommissionAmount";

      const [bySettlement, pendingByVendor] = await Promise.all([
        cfg.model.aggregate([
          { $match: baseMatch({ [cfg.paymentStatusField]: "PAID" }) },
          {
            $group: {
              _id: "$settlementStatus",
              n: { $sum: 1 },
              gross: { $sum: `$${cfg.amountField}` },
              commission: { $sum: { $ifNull: [commissionField, 0] } },
              vendorAmount: { $sum: { $ifNull: ["$vendorAmount", 0] } },
            },
          },
        ]),
        cfg.model.aggregate([
          {
            $match: baseMatch({
              [cfg.paymentStatusField]: "PAID",
              [cfg.statusField]: { $nin: BOOKING_NOT_REVENUE },
              settlementStatus: { $not: /^(SETTLED|PAID|COMPLETED)$/i },
            }),
          },
          {
            $group: {
              _id: "$vendor",
              bookings: { $sum: 1 },
              pendingAmount: { $sum: { $ifNull: ["$vendorAmount", 0] } },
              commission: { $sum: { $ifNull: [commissionField, 0] } },
            },
          },
          { $sort: { pendingAmount: -1 } },
          { $limit: 20 },
        ]),
      ]);

      return { type, bySettlement, pendingByVendor };
    })
  );

  const vendorMap = await loadVendorMap(settlement.flatMap((s) => s.pendingByVendor.map((v) => v._id)));

  sendOk(res, {
    payments,
    settlement: settlement.map((s) => ({
      type: s.type,
      bySettlementStatus: s.bySettlement.map((r) => ({
        settlementStatus: r._id || "UNSET",
        count: r.n,
        gross: r.gross,
        commission: r.commission,
        vendorAmount: r.vendorAmount,
      })),
      pendingByVendor: s.pendingByVendor.map((v) => ({
        vendorId: String(v._id),
        vendorName: vendorMap[String(v._id)]?.businessName || vendorMap[String(v._id)]?.name || "",
        bookings: v.bookings,
        pendingAmount: v.pendingAmount,
        commission: v.commission,
      })),
    })),
    note: "Commission/settlement fields abhi sirf hotel aur homestay bookings me hain. Baaki types me sirf gross payment dikhta hai.",
  });
});