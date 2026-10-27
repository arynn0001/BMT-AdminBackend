/**
 * Darshan Controller (Admin)
 * Overview, temples, types, slots, availability (date wise), bookings.
 */
import mongoose from "mongoose";
import {
  Darshan,
  DarshanType,
  DarshanSlot,
  DarshanSlotAvailability,
  DarshanBooking,
  DARSHAN_STATUSES,
  DARSHAN_BOOKING_STATUSES,
} from "../models/darshan.model.js";

/* ================= HELPERS ================= */
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error("DARSHAN ADMIN ERROR:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: err.message },
    });
  }
};

const fail = (res, status, code, message, extra = {}) =>
  res.status(status).json({ success: false, error: { code, message }, ...extra });

const isValidId = (id) => mongoose.isValidObjectId(id);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rx = (s) => new RegExp(escapeRegex(String(s).trim()), "i");
const bool = (v) => v === true || String(v).toLowerCase() === "true";

const TZ = "Asia/Kolkata";
const DAY_MS = 24 * 60 * 60 * 1000;

const istKey = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const istStartOfDay = (d) => new Date(`${istKey(d)}T00:00:00+05:30`);
// Availability.date / bookingDate vendor side par UTC midnight ("2026-10-15" -> 00:00Z)
const utcToday = (d) => new Date(`${istKey(d)}T00:00:00Z`);
const utcDayRange = (value) => {
  const s = new Date(value);
  if (Number.isNaN(s.getTime())) return null;
  s.setUTCHours(0, 0, 0, 0);
  return { start: s, end: new Date(s.getTime() + DAY_MS) };
};

// "18:00" / "6:30 PM" -> minutes from midnight
const toMinutes = (time) => {
  const m = String(time || "").trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3] === "PM" && h < 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  return h * 60 + Number(m[2]);
};

const pageParams = (q) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const pagination = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

const VENDOR_FIELDS = "name email phone companyName businessName";
const USER_FIELDS = "fullname name email phone";
const TEMPLE_FIELDS = "name templeName deityName city state mainImage";

const PAID_ACTIVE = { paymentStatus: "paid", bookingStatus: { $nin: ["cancelled", "refunded"] } };
const REVENUE_EXPR = {
  $cond: [
    {
      $and: [
        { $eq: ["$paymentStatus", "paid"] },
        { $not: [{ $in: ["$bookingStatus", ["cancelled", "refunded"]] }] },
      ],
    },
    "$totalAmount",
    0,
  ],
};

/* ================= OVERVIEW (Dashboard) ================= */
export const getOverview = wrap(async (_req, res) => {
  const now = new Date();
  const todayStart = istStartOfDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);

  const dayStart = utcToday(now);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const todayMatch = { date: { $gte: dayStart, $lt: dayEnd }, isActive: true };

  const live = { status: "approved", isPublished: true, isActive: true };

  const [
    totalTemples,
    liveTemples,
    liveStates,
    liveCities,
    templeStatusAgg,
    activeTypes,
    slotsTodayAgg,
    bookingsToday,
    visitsTodayAgg,
    bookingStatusAgg,
    passesAgg,
    checkedIn,
    checkedInToday,
    entryRejected,
    grossAll,
    grossThisWeek,
    grossLastWeek,
    pendingTemples,
    todayAvailability,
    topTemplesAgg,
    recentBookings,
  ] = await Promise.all([
    Darshan.countDocuments(),
    Darshan.countDocuments(live),
    Darshan.distinct("state", live),
    Darshan.distinct("city", live),
    Darshan.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    DarshanType.countDocuments({ isActive: true }),

    DarshanSlotAvailability.aggregate([
      { $match: todayMatch },
      {
        $group: {
          _id: null,
          slots: { $sum: 1 },
          totalCapacity: { $sum: "$totalCapacity" },
          bookedCapacity: { $sum: "$bookedCapacity" },
          blocked: { $sum: { $cond: ["$isBlocked", 1, 0] } },
          soldOut: { $sum: { $cond: ["$isSoldOut", 1, 0] } },
        },
      },
    ]),

    DarshanBooking.countDocuments({ createdAt: { $gte: todayStart, $lt: tomorrowStart } }),
    DarshanBooking.aggregate([
      {
        $match: {
          bookingDate: { $gte: dayStart, $lt: dayEnd },
          bookingStatus: { $nin: ["cancelled", "refunded"] },
        },
      },
      { $group: { _id: null, bookings: { $sum: 1 }, persons: { $sum: "$totalPersons" } } },
    ]),
    DarshanBooking.aggregate([{ $group: { _id: "$bookingStatus", count: { $sum: 1 } } }]),

    // Passes issued = paid bookings ke total persons
    DarshanBooking.aggregate([
      { $match: PAID_ACTIVE },
      { $group: { _id: null, bookings: { $sum: 1 }, persons: { $sum: "$totalPersons" } } },
    ]),
    DarshanBooking.countDocuments({ entryStatus: "checked_in" }),
    DarshanBooking.countDocuments({
      entryStatus: "checked_in",
      checkedInAt: { $gte: todayStart, $lt: tomorrowStart },
    }),
    DarshanBooking.countDocuments({ entryStatus: "rejected" }),

    DarshanBooking.aggregate([
      { $match: PAID_ACTIVE },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    DarshanBooking.aggregate([
      { $match: { ...PAID_ACTIVE, createdAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    DarshanBooking.aggregate([
      { $match: { ...PAID_ACTIVE, createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),

    Darshan.countDocuments({ status: "pending" }),

    DarshanSlotAvailability.find(todayMatch)
      .limit(500)
      .populate("darshanId", "name templeName city state")
      .populate("slotId", "name startTime endTime")
      .populate("darshanTypeId", "name type")
      .lean(),

    DarshanBooking.aggregate([
      { $match: PAID_ACTIVE },
      {
        $group: {
          _id: "$darshanId",
          bookings: { $sum: 1 },
          persons: { $sum: "$totalPersons" },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),

    DarshanBooking.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("bookingId customerName totalPersons totalAmount bookingStatus paymentStatus bookingDate darshanId slotId createdAt")
      .populate("darshanId", "name templeName city")
      .populate("slotId", "name startTime endTime")
      .lean(),
  ]);

  // ---------- slots today ----------
  const s = slotsTodayAgg[0] || { slots: 0, totalCapacity: 0, bookedCapacity: 0, blocked: 0, soldOut: 0 };

  // ---------- temple cards: next slot + slot load ----------
  const nowMinutes = toMinutes(
    now.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
  );

  const byTemple = new Map();
  todayAvailability.forEach((a) => {
    const id = String(a.darshanId?._id || a.darshanId);
    if (!byTemple.has(id)) {
      byTemple.set(id, { temple: a.darshanId, total: 0, booked: 0, slots: [] });
    }
    const t = byTemple.get(id);
    t.total += a.totalCapacity || 0;
    t.booked += a.bookedCapacity || 0;
    t.slots.push({ minutes: toMinutes(a.slotId?.startTime), startTime: a.slotId?.startTime });
  });

  const templeCards = [...byTemple.values()]
    .map((t) => {
      const upcoming = t.slots
        .filter((x) => x.minutes !== null && nowMinutes !== null && x.minutes >= nowMinutes)
        .sort((a, b) => a.minutes - b.minutes);
      return {
        darshanId: t.temple?._id,
        name: t.temple?.name,
        templeName: t.temple?.templeName,
        city: t.temple?.city,
        state: t.temple?.state,
        nextSlot: upcoming[0]?.startTime || null,
        slotsToday: t.slots.length,
        totalCapacity: t.total,
        bookedCapacity: t.booked,
        slotLoadPercent: t.total ? Math.round((t.booked / t.total) * 100) : 0,
      };
    })
    .sort((a, b) => b.slotLoadPercent - a.slotLoadPercent)
    .slice(0, 6);

  const todaySlots = todayAvailability
    .map((a) => ({
      _id: a._id,
      temple: a.darshanId?.templeName || a.darshanId?.name || "—",
      city: a.darshanId?.city || "",
      darshanType: a.darshanTypeId?.name || "",
      slot: a.slotId?.name || "",
      startTime: a.slotId?.startTime,
      endTime: a.slotId?.endTime,
      bookedCapacity: a.bookedCapacity,
      totalCapacity: a.totalCapacity,
      availableCapacity: a.availableCapacity,
      isBlocked: !!a.isBlocked,
      isSoldOut: !!a.isSoldOut,
    }))
    .sort((a, b) => (toMinutes(a.startTime) ?? 9999) - (toMinutes(b.startTime) ?? 9999))
    .slice(0, 12);

  // ---------- top temples ----------
  const topIds = topTemplesAgg.map((t) => t._id);
  const topDocs = topIds.length
    ? await Darshan.find({ _id: { $in: topIds } }).select("name templeName city state mainImage").lean()
    : [];
  const topMap = new Map(topDocs.map((d) => [String(d._id), d]));
  const topTemples = topTemplesAgg.map((t) => ({ ...t, temple: topMap.get(String(t._id)) || null }));

  // ---------- gross / wow ----------
  const thisWeek = grossThisWeek[0]?.total || 0;
  const lastWeek = grossLastWeek[0]?.total || 0;
  const wowPercent = lastWeek > 0 ? +(((thisWeek - lastWeek) / lastWeek) * 100).toFixed(1) : null;
  const scanned = checkedIn + entryRejected;

  res.json({
    success: true,
    data: {
      stats: {
        totalTemples,
        liveTemples,
        liveStates: liveStates.filter(Boolean).length,
        liveCities: liveCities.filter(Boolean).length,
        activeDarshanTypes: activeTypes,
        slotsToday: s.slots,
        capacityToday: s.totalCapacity,
        bookedCapacityToday: s.bookedCapacity,
        capacityPercentToday: s.totalCapacity ? Math.round((s.bookedCapacity / s.totalCapacity) * 100) : 0,
        blockedSlotsToday: s.blocked,
        soldOutSlotsToday: s.soldOut,
        bookingsToday,
        visitsToday: visitsTodayAgg[0]?.bookings || 0,
        visitorsToday: visitsTodayAgg[0]?.persons || 0,
        passesIssued: passesAgg[0]?.persons || 0,
        paidBookings: passesAgg[0]?.bookings || 0,
        checkedIn,
        checkedInToday,
        verifiedPercent: scanned ? Math.round((checkedIn / scanned) * 100) : null,
        grossValue: grossAll[0]?.total || 0,
        grossValueWoWPercent: wowPercent,
        pendingReview: pendingTemples,
      },
      templeStatusBreakdown: templeStatusAgg.reduce(
        (a, x) => ({ ...a, [x._id]: x.count }),
        { draft: 0, pending: 0, approved: 0, rejected: 0, inactive: 0 }
      ),
      bookingStatusBreakdown: bookingStatusAgg.reduce(
        (a, x) => ({ ...a, [x._id]: x.count }),
        { pending: 0, confirmed: 0, cancelled: 0, completed: 0, refunded: 0 }
      ),
      templeCards,
      todaySlots,
      topTemples,
      recentBookings,
    },
  });
});

/* =====================================================================
 * TEMPLES (Darshan)
 * ===================================================================== */
export const listDarshans = wrap(async (req, res) => {
  const { search, status, city, state, vendor, deityType, isPublished, isActive, sort } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (status) filter.status = String(status).toLowerCase();
  if (city) filter.city = new RegExp(`^${escapeRegex(city.trim())}$`, "i");
  if (state) filter.state = new RegExp(`^${escapeRegex(state.trim())}$`, "i");
  if (deityType) filter.deityType = deityType;
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (isPublished !== undefined) filter.isPublished = isPublished === "true";
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (search?.trim()) {
    const r = rx(search);
    filter.$or = [{ name: r }, { templeName: r }, { deityName: r }, { city: r }, { state: r }];
  }

  const sortMap = { oldest: { createdAt: 1 }, name: { name: 1 } };

  const [items, total] = await Promise.all([
    Darshan.find(filter)
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-description -galleryImages -entryPolicy -cancellationPolicy")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    Darshan.countDocuments(filter),
  ]);

  const ids = items.map((d) => d._id);
  const [typeAgg, slotAgg, bookingAgg] = ids.length
    ? await Promise.all([
        DarshanType.aggregate([
          { $match: { darshanId: { $in: ids } } },
          { $group: { _id: "$darshanId", types: { $sum: 1 } } },
        ]),
        DarshanSlot.aggregate([
          { $match: { darshanId: { $in: ids } } },
          { $group: { _id: "$darshanId", slots: { $sum: 1 } } },
        ]),
        DarshanBooking.aggregate([
          { $match: { darshanId: { $in: ids } } },
          {
            $group: {
              _id: "$darshanId",
              totalBookings: { $sum: 1 },
              visitors: { $sum: "$totalPersons" },
              revenue: { $sum: REVENUE_EXPR },
            },
          },
        ]),
      ])
    : [[], [], []];

  const tMap = new Map(typeAgg.map((x) => [String(x._id), x.types]));
  const sMap = new Map(slotAgg.map((x) => [String(x._id), x.slots]));
  const bMap = new Map(bookingAgg.map((x) => [String(x._id), x]));

  const data = items.map((d) => {
    const b = bMap.get(String(d._id));
    return {
      ...d,
      typeCount: tMap.get(String(d._id)) || 0,
      slotCount: sMap.get(String(d._id)) || 0,
      bookingStats: {
        totalBookings: b?.totalBookings || 0,
        visitors: b?.visitors || 0,
        revenue: b?.revenue || 0,
      },
    };
  });

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

export const getDarshanById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid darshan id");

  const darshan = await Darshan.findById(id).populate("vendorId", VENDOR_FIELDS).lean();
  if (!darshan) return fail(res, 404, "NOT_FOUND", "Darshan not found");

  const dayStart = utcToday(new Date());

  const [types, slots, upcomingAvailability, bookingAgg, entryAgg] = await Promise.all([
    DarshanType.find({ darshanId: darshan._id }).sort({ createdAt: -1 }).lean(),
    DarshanSlot.find({ darshanId: darshan._id })
      .populate("darshanTypeId", "name type")
      .sort({ startTime: 1 })
      .lean(),
    DarshanSlotAvailability.find({ darshanId: darshan._id, date: { $gte: dayStart } })
      .sort({ date: 1 })
      .limit(30)
      .populate("slotId", "name startTime endTime")
      .populate("darshanTypeId", "name type")
      .lean(),
    DarshanBooking.aggregate([
      { $match: { darshanId: darshan._id } },
      {
        $group: {
          _id: "$bookingStatus",
          count: { $sum: 1 },
          persons: { $sum: "$totalPersons" },
          amount: { $sum: "$totalAmount" },
        },
      },
    ]),
    DarshanBooking.aggregate([
      { $match: { darshanId: darshan._id } },
      { $group: { _id: "$entryStatus", count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    data: { ...darshan, types, slots, upcomingAvailability, bookingStats: bookingAgg, entryStats: entryAgg },
  });
});

export const updateDarshanStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const status = String(req.body?.status || "").toLowerCase();
  const reason = String(req.body?.rejectionReason || "").trim();

  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid darshan id");
  if (!DARSHAN_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${DARSHAN_STATUSES.join(", ")}`);
  }
  if (status === "rejected" && !reason) {
    return fail(res, 400, "REASON_REQUIRED", "rejectionReason is required when rejecting");
  }

  const update = { $set: { status } };
  if (status !== "approved") update.$set.isPublished = false; // approved nahi to live nahi
  if (status === "rejected") update.$set.rejectionReason = reason.slice(0, 300);
  else update.$unset = { rejectionReason: "" };

  const darshan = await Darshan.findByIdAndUpdate(id, update, { new: true });
  if (!darshan) return fail(res, 404, "NOT_FOUND", "Darshan not found");

  res.json({ success: true, message: `Darshan ${status}`, data: darshan });
});

export const setDarshanPublish = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid darshan id");
  if (req.body?.isPublished === undefined) {
    return fail(res, 400, "INVALID_BODY", "isPublished (true/false) is required");
  }

  const publish = bool(req.body.isPublished);
  const darshan = await Darshan.findById(id);
  if (!darshan) return fail(res, 404, "NOT_FOUND", "Darshan not found");
  if (publish && darshan.status !== "approved") {
    return fail(res, 400, "NOT_APPROVED", "Darshan must be approved before publishing");
  }

  const updated = await Darshan.findByIdAndUpdate(id, { isPublished: publish }, { new: true });
  res.json({ success: true, message: publish ? "Darshan published" : "Darshan unpublished", data: updated });
});

export const toggleDarshan = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid darshan id");

  const darshan = await Darshan.findById(id);
  if (!darshan) return fail(res, 404, "NOT_FOUND", "Darshan not found");

  const updated = await Darshan.findByIdAndUpdate(id, { isActive: !darshan.isActive }, { new: true });
  res.json({
    success: true,
    message: updated.isActive ? "Darshan activated" : "Darshan deactivated",
    data: updated,
  });
});

// ---------- ek temple ke sub-lists ----------
export const getDarshanTypesOf = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid darshan id");
  const data = await DarshanType.find({ darshanId: id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, count: data.length, data });
});

export const getDarshanSlotsOf = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid darshan id");
  const data = await DarshanSlot.find({ darshanId: id })
    .populate("darshanTypeId", "name type")
    .sort({ startTime: 1 })
    .lean();
  res.json({ success: true, count: data.length, data });
});

export const getDarshanAvailabilityOf = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid darshan id");

  const { from, to } = req.query;
  const filter = { darshanId: id };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const data = await DarshanSlotAvailability.find(filter)
    .sort({ date: -1 })
    .limit(200)
    .populate("slotId", "name startTime endTime")
    .populate("darshanTypeId", "name type")
    .lean();
  res.json({ success: true, count: data.length, data });
});

export const getDarshanBookingsOf = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid darshan id");

  const { page, limit, skip } = pageParams(req.query);
  const filter = { darshanId: id };
  if (req.query.bookingStatus) filter.bookingStatus = String(req.query.bookingStatus).toLowerCase();

  const [data, total] = await Promise.all([
    DarshanBooking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-qrCode -razorpaySignature")
      .lean(),
    DarshanBooking.countDocuments(filter),
  ]);

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

/* =====================================================================
 * DARSHAN TYPES
 * ===================================================================== */
export const listTypes = wrap(async (req, res) => {
  const { darshanId, vendor, type, status, isActive, isPublished, search } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (darshanId) {
    if (!isValidId(darshanId)) return fail(res, 400, "INVALID_ID", "Invalid darshanId");
    filter.darshanId = darshanId;
  }
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (type) filter.type = type;
  if (status) filter.status = String(status).toLowerCase();
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (isPublished !== undefined) filter.isPublished = isPublished === "true";
  if (search?.trim()) filter.name = rx(search);

  const [data, total] = await Promise.all([
    DarshanType.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("darshanId", TEMPLE_FIELDS)
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    DarshanType.countDocuments(filter),
  ]);

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

export const getTypeById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid type id");

  const type = await DarshanType.findById(id)
    .populate("darshanId", TEMPLE_FIELDS)
    .populate("vendorId", VENDOR_FIELDS)
    .lean();
  if (!type) return fail(res, 404, "NOT_FOUND", "Darshan type not found");

  const slots = await DarshanSlot.find({ darshanTypeId: type._id }).sort({ startTime: 1 }).lean();
  res.json({ success: true, data: { ...type, slots } });
});

export const toggleType = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid type id");

  const type = await DarshanType.findById(id);
  if (!type) return fail(res, 404, "NOT_FOUND", "Darshan type not found");

  const updated = await DarshanType.findByIdAndUpdate(id, { isActive: !type.isActive }, { new: true });
  res.json({
    success: true,
    message: updated.isActive ? "Darshan type activated" : "Darshan type deactivated",
    data: updated,
  });
});

/* =====================================================================
 * SLOTS
 * ===================================================================== */
export const listSlots = wrap(async (req, res) => {
  const { darshanId, darshanTypeId, vendor, isActive, isBookable, isSoldOut, search } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (darshanId) {
    if (!isValidId(darshanId)) return fail(res, 400, "INVALID_ID", "Invalid darshanId");
    filter.darshanId = darshanId;
  }
  if (darshanTypeId) {
    if (!isValidId(darshanTypeId)) return fail(res, 400, "INVALID_ID", "Invalid darshanTypeId");
    filter.darshanTypeId = darshanTypeId;
  }
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (isBookable !== undefined) filter.isBookable = isBookable === "true";
  if (isSoldOut !== undefined) filter.isSoldOut = isSoldOut === "true";
  if (search?.trim()) filter.name = rx(search);

  const [data, total] = await Promise.all([
    DarshanSlot.find(filter)
      .sort({ darshanId: 1, startTime: 1 })
      .skip(skip)
      .limit(limit)
      .populate("darshanId", "name templeName city state")
      .populate("darshanTypeId", "name type")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    DarshanSlot.countDocuments(filter),
  ]);

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

export const getSlotById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid slot id");

  const slot = await DarshanSlot.findById(id)
    .populate("darshanId", TEMPLE_FIELDS)
    .populate("darshanTypeId", "name type")
    .populate("vendorId", VENDOR_FIELDS)
    .lean();
  if (!slot) return fail(res, 404, "NOT_FOUND", "Darshan slot not found");

  const upcoming = await DarshanSlotAvailability.find({
    slotId: slot._id,
    date: { $gte: utcToday(new Date()) },
  })
    .sort({ date: 1 })
    .limit(30)
    .lean();

  res.json({ success: true, data: { ...slot, upcomingAvailability: upcoming } });
});

export const toggleSlot = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid slot id");

  const slot = await DarshanSlot.findById(id);
  if (!slot) return fail(res, 404, "NOT_FOUND", "Darshan slot not found");

  const updated = await DarshanSlot.findByIdAndUpdate(id, { isActive: !slot.isActive }, { new: true });
  res.json({
    success: true,
    message: updated.isActive ? "Slot activated" : "Slot deactivated",
    data: updated,
  });
});

/* =====================================================================
 * AVAILABILITY (date wise)
 * ===================================================================== */
export const listAvailability = wrap(async (req, res) => {
  const { darshanId, darshanTypeId, slotId, vendor, date, from, to, isBlocked, isSoldOut, isBookable, isActive } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (darshanId) {
    if (!isValidId(darshanId)) return fail(res, 400, "INVALID_ID", "Invalid darshanId");
    filter.darshanId = darshanId;
  }
  if (darshanTypeId) {
    if (!isValidId(darshanTypeId)) return fail(res, 400, "INVALID_ID", "Invalid darshanTypeId");
    filter.darshanTypeId = darshanTypeId;
  }
  if (slotId) {
    if (!isValidId(slotId)) return fail(res, 400, "INVALID_ID", "Invalid slotId");
    filter.slotId = slotId;
  }
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (isBlocked !== undefined) filter.isBlocked = isBlocked === "true";
  if (isSoldOut !== undefined) filter.isSoldOut = isSoldOut === "true";
  if (isBookable !== undefined) filter.isBookable = isBookable === "true";
  if (isActive !== undefined) filter.isActive = isActive === "true";

  if (date) {
    const range = utcDayRange(date);
    if (!range) return fail(res, 400, "INVALID_DATE", "Invalid date");
    filter.date = { $gte: range.start, $lt: range.end };
  } else if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const [data, total] = await Promise.all([
    DarshanSlotAvailability.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate("darshanId", "name templeName city state")
      .populate("darshanTypeId", "name type")
      .populate("slotId", "name startTime endTime")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    DarshanSlotAvailability.countDocuments(filter),
  ]);

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

export const getAvailabilityById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid availability id");

  const item = await DarshanSlotAvailability.findById(id)
    .populate("darshanId", TEMPLE_FIELDS)
    .populate("darshanTypeId", "name type")
    .populate("slotId", "name startTime endTime")
    .populate("vendorId", VENDOR_FIELDS)
    .lean();
  if (!item) return fail(res, 404, "NOT_FOUND", "Slot availability not found");

  const bookingAgg = await DarshanBooking.aggregate([
    { $match: { availabilityId: item._id } },
    {
      $group: {
        _id: "$bookingStatus",
        count: { $sum: 1 },
        persons: { $sum: "$totalPersons" },
        amount: { $sum: "$totalAmount" },
      },
    },
  ]);

  res.json({ success: true, data: { ...item, bookingStats: bookingAgg } });
});

// Admin block / unblock (blocked date par user booking nahi kar paata)
export const setAvailabilityBlock = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid availability id");
  if (req.body?.isBlocked === undefined) {
    return fail(res, 400, "INVALID_BODY", "isBlocked (true/false) is required");
  }

  const blocked = bool(req.body.isBlocked);
  const reason = String(req.body?.blockedReason || "").trim().slice(0, 300);
  if (blocked && !reason) {
    return fail(res, 400, "REASON_REQUIRED", "blockedReason is required when blocking");
  }

  const updated = await DarshanSlotAvailability.findByIdAndUpdate(
    id,
    { isBlocked: blocked, blockedReason: blocked ? reason : "" },
    { new: true }
  );
  if (!updated) return fail(res, 404, "NOT_FOUND", "Slot availability not found");

  res.json({ success: true, message: blocked ? "Date blocked" : "Date unblocked", data: updated });
});

/* =====================================================================
 * BOOKINGS
 * ===================================================================== */
export const listBookings = wrap(async (req, res) => {
  const {
    search, bookingStatus, paymentStatus, entryStatus,
    darshanId, darshanTypeId, slotId, availabilityId, vendor,
    bookingDate, from, to,
  } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (bookingStatus) filter.bookingStatus = String(bookingStatus).toLowerCase();
  if (paymentStatus) filter.paymentStatus = String(paymentStatus).toLowerCase();
  if (entryStatus) filter.entryStatus = entryStatus;
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;

  for (const [key, value] of Object.entries({ darshanId, darshanTypeId, slotId, availabilityId })) {
    if (value) {
      if (!isValidId(value)) return fail(res, 400, "INVALID_ID", `Invalid ${key}`);
      filter[key] = value;
    }
  }

  if (bookingDate) {
    const range = utcDayRange(bookingDate);
    if (!range) return fail(res, 400, "INVALID_DATE", "Invalid bookingDate");
    filter.bookingDate = { $gte: range.start, $lt: range.end };
  } else if (from || to) {
    filter.bookingDate = {};
    if (from) filter.bookingDate.$gte = new Date(from);
    if (to) filter.bookingDate.$lte = new Date(to);
  }

  if (search?.trim()) {
    const r = rx(search);
    filter.$or = [{ bookingId: r }, { customerName: r }, { customerEmail: r }, { customerPhone: r }];
  }

  const [data, total, summaryAgg] = await Promise.all([
    DarshanBooking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-qrCode -razorpaySignature")
      .populate("darshanId", TEMPLE_FIELDS)
      .populate("darshanTypeId", "name type")
      .populate("slotId", "name startTime endTime")
      .populate("vendorId", VENDOR_FIELDS)
      .populate("userId", USER_FIELDS)
      .lean(),
    DarshanBooking.countDocuments(filter),
    DarshanBooking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$bookingStatus",
          count: { $sum: 1 },
          persons: { $sum: "$totalPersons" },
          paidAmount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0] } },
        },
      },
    ]),
  ]);

  const summary = { pending: 0, confirmed: 0, cancelled: 0, completed: 0, refunded: 0, paidAmount: 0 };
  summaryAgg.forEach((s) => {
    summary[s._id] = s.count;
    if (!["cancelled", "refunded"].includes(s._id)) summary.paidAmount += s.paidAmount || 0;
  });

  res.json({ success: true, count: data.length, data, summary, pagination: pagination(page, limit, total) });
});

// _id ya bookingId (DAR-...) dono chalega
export const getBookingById = wrap(async (req, res) => {
  const { id } = req.params;
  const query = isValidId(id) ? { _id: id } : { bookingId: String(id).toUpperCase() };

  const booking = await DarshanBooking.findOne(query)
    .select("-razorpaySignature")
    .populate("darshanId", "name templeName deityName address city state pincode mainImage")
    .populate("darshanTypeId", "name type image")
    .populate("slotId", "name startTime endTime")
    .populate("availabilityId", "date totalCapacity availableCapacity bookedCapacity isBlocked")
    .populate("vendorId", VENDOR_FIELDS)
    .populate("userId", USER_FIELDS)
    .lean();
  if (!booking) return fail(res, 404, "NOT_FOUND", "Booking not found");

  res.json({ success: true, data: booking });
});

/* Admin override:
 *   pending   -> confirmed | cancelled
 *   confirmed -> cancelled | completed
 *   cancelled -> refunded   (sirf jab paymentStatus = paid; asli refund Razorpay se alag hota hai)
 * Vendor flow me capacity booking banate hi minus hoti hai, isliye CANCEL par
 * availability me persons wapas add hote hain (user cancel jaisa hi).
 */
const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled", "completed"],
  cancelled: ["refunded"],
};

export const updateBookingStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const status = String(req.body?.bookingStatus || req.body?.status || "").toLowerCase();
  const reason = String(req.body?.reason || "").trim().slice(0, 300);

  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid booking id");
  if (!DARSHAN_BOOKING_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${DARSHAN_BOOKING_STATUSES.join(", ")}`);
  }

  const booking = await DarshanBooking.findById(id);
  if (!booking) return fail(res, 404, "NOT_FOUND", "Booking not found");

  const allowed = TRANSITIONS[booking.bookingStatus] || [];
  if (!allowed.includes(status)) {
    return fail(
      res,
      400,
      "INVALID_TRANSITION",
      `Cannot change ${booking.bookingStatus} to ${status}. Allowed: ${allowed.join(", ") || "none"}`
    );
  }
  if (status === "cancelled" && !reason) {
    return fail(res, 400, "REASON_REQUIRED", "reason is required for cancel");
  }
  if (status === "refunded" && booking.paymentStatus !== "paid") {
    return fail(res, 400, "NOT_PAID", "Only paid bookings can be marked refunded");
  }
  if (status === "completed" && booking.bookingDate > new Date(utcToday(new Date()).getTime() + DAY_MS - 1)) {
    return fail(res, 400, "NOT_STARTED", "Visit date has not come yet");
  }

  const set = { bookingStatus: status };
  if (status === "cancelled") {
    set.cancelledAt = new Date();
    set.cancellationReason = `Admin: ${reason}`;
  }
  if (status === "refunded") set.paymentStatus = "refunded";

  // Atomic: beech me status badal gaya to update nahi hoga (double-click safe)
  const updated = await DarshanBooking.findOneAndUpdate(
    { _id: booking._id, bookingStatus: booking.bookingStatus },
    { $set: set },
    { new: true }
  );
  if (!updated) return fail(res, 409, "STATUS_CHANGED", "Booking status changed, please refresh");

  if (status === "cancelled") {
    const n = updated.totalPersons || 0;
    await DarshanSlotAvailability.updateOne(
      { _id: updated.availabilityId, bookedCapacity: { $gte: n } },
      [
        {
          $set: {
            bookedCapacity: { $subtract: ["$bookedCapacity", n] },
            availableCapacity: { $min: [{ $add: ["$availableCapacity", n] }, "$totalCapacity"] },
            isSoldOut: false,
          },
        },
      ]
    );
  }

  res.json({ success: true, message: `Booking ${status}`, data: updated });
});