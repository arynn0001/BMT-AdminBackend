/**
 * Events Controller (Admin) - Night club events vertical
 * Overview, clubs, events, tickets, tables, table pricing, bookings.
 */
import mongoose from "mongoose";
import {
  NightClub,
  NightClubEvent,
  NightClubEventTicket,
  NightClubTable,
  NightClubTablePricing,
  NightClubEventBooking,
  CLUB_STATUSES,
  EVENT_STATUSES,
  EVENT_BOOKING_STATUSES,
} from "../models/events.model.js";

/* ================= HELPERS ================= */
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error("EVENTS ADMIN ERROR:", err);
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

const TZ = "Asia/Kolkata";
const DAY_MS = 24 * 60 * 60 * 1000;

const istKey = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const istStartOfDay = (d) => new Date(`${istKey(d)}T00:00:00+05:30`);
// eventDate vendor side par "YYYY-MM-DD" -> UTC midnight store hoti hai
const utcToday = (d) => new Date(`${istKey(d)}T00:00:00Z`);

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
const CLUB_FIELDS = "name city address logo coverImage";
const EVENT_FIELDS = "title eventType eventDate startTime endTime bannerImage";

const bool = (v) => v === true || v === "true";

/* ================= OVERVIEW (Dashboard) ================= */
export const getOverview = wrap(async (_req, res) => {
  const now = new Date();
  const todayStart = istStartOfDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);

  const live = { status: "approved", isPublished: true, eventDate: { $gte: utcToday(now) } };
  const paid = { paymentStatus: "paid", bookingStatus: { $nin: ["cancelled", "refunded"] } };

  const liveEventIds = await NightClubEvent.distinct("_id", live);
  const ticketMatch = { eventId: { $in: liveEventIds }, isActive: true };

  const [
    totalEvents,
    liveVenues,
    totalClubs,
    clubStatusAgg,
    eventStatusAgg,
    ticketTotals,
    ticketTiers,
    bookingsToday,
    bookingStatusAgg,
    checkedIn,
    entryRejected,
    checkedInToday,
    grossAll,
    grossThisWeek,
    grossLastWeek,
    pendingClubs,
    pendingEvents,
    upcomingEvents,
    recentBookings,
  ] = await Promise.all([
    NightClubEvent.countDocuments(),
    NightClubEvent.distinct("nightClubId", live),
    NightClub.countDocuments(),
    NightClub.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    NightClubEvent.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    NightClubEventTicket.aggregate([
      { $match: ticketMatch },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalQuantity" },
          sold: { $sum: "$soldQuantity" },
          available: { $sum: "$availableQuantity" },
        },
      },
    ]),
    NightClubEventTicket.aggregate([
      { $match: ticketMatch },
      {
        $group: {
          _id: "$ticketType",
          total: { $sum: "$totalQuantity" },
          sold: { $sum: "$soldQuantity" },
          avgPrice: { $avg: "$price" },
        },
      },
      { $sort: { avgPrice: 1 } },
    ]),

    NightClubEventBooking.countDocuments({ createdAt: { $gte: todayStart, $lt: tomorrowStart } }),
    NightClubEventBooking.aggregate([{ $group: { _id: "$bookingStatus", count: { $sum: 1 } } }]),

    NightClubEventBooking.countDocuments({ entryStatus: "checked_in" }),
    NightClubEventBooking.countDocuments({ entryStatus: "rejected" }),
    NightClubEventBooking.countDocuments({
      entryStatus: "checked_in",
      checkedInAt: { $gte: todayStart, $lt: tomorrowStart },
    }),

    NightClubEventBooking.aggregate([
      { $match: paid },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    NightClubEventBooking.aggregate([
      { $match: { ...paid, createdAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    NightClubEventBooking.aggregate([
      { $match: { ...paid, createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),

    NightClub.countDocuments({ status: "pending" }),
    NightClubEvent.countDocuments({ status: "pending" }),

    NightClubEvent.find(live)
      .sort({ eventDate: 1 })
      .limit(6)
      .select("title eventType eventDate startTime endTime bannerImage totalCapacity nightClubId")
      .populate("nightClubId", CLUB_FIELDS)
      .lean(),

    NightClubEventBooking.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("bookingId customerName ticketName quantity totalAmount bookingStatus paymentStatus eventId nightClubId createdAt")
      .populate("eventId", "title eventDate")
      .populate("nightClubId", "name city")
      .lean(),
  ]);

  const t = ticketTotals[0] || { total: 0, sold: 0, available: 0 };
  const thisWeek = grossThisWeek[0]?.total || 0;
  const lastWeek = grossLastWeek[0]?.total || 0;
  const wowPercent = lastWeek > 0 ? +(((thisWeek - lastWeek) / lastWeek) * 100).toFixed(1) : null;
  const scanned = checkedIn + entryRejected;

  res.json({
    success: true,
    data: {
      stats: {
        totalEvents,
        liveEvents: liveEventIds.length,
        liveVenues: liveVenues.length,
        totalClubs,
        ticketsOnSale: t.available,
        ticketsTotal: t.total,
        ticketsSold: t.sold,
        ticketsAvailablePercent: t.total ? Math.round((t.available / t.total) * 100) : 0,
        bookingsToday,
        gateScans: checkedIn,
        gateScansToday: checkedInToday,
        gateValidPercent: scanned ? +((checkedIn / scanned) * 100).toFixed(1) : null,
        grossValue: grossAll[0]?.total || 0,
        grossValueWoWPercent: wowPercent,
        pendingReview: pendingClubs + pendingEvents,
        pendingClubs,
        pendingEvents,
      },
      clubStatusBreakdown: clubStatusAgg.reduce(
        (a, s) => ({ ...a, [s._id]: s.count }),
        { draft: 0, pending: 0, approved: 0, rejected: 0, inactive: 0 }
      ),
      eventStatusBreakdown: eventStatusAgg.reduce(
        (a, s) => ({ ...a, [s._id]: s.count }),
        { draft: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0, completed: 0 }
      ),
      bookingStatusBreakdown: bookingStatusAgg.reduce(
        (a, s) => ({ ...a, [s._id]: s.count }),
        { pending: 0, confirmed: 0, cancelled: 0, completed: 0, refunded: 0 }
      ),
      ticketTiers: ticketTiers.map((x) => ({
        ticketType: x._id,
        totalQuantity: x.total,
        soldQuantity: x.sold,
        sellThroughPercent: x.total ? Math.round((x.sold / x.total) * 100) : 0,
        avgPrice: Math.round(x.avgPrice || 0),
      })),
      upcomingEvents,
      recentBookings,
    },
  });
});

/* =====================================================================
 * CLUBS
 * ===================================================================== */
export const listClubs = wrap(async (req, res) => {
  const { search, status, venueType, city, vendor, isPublished } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (status) filter.status = String(status).toLowerCase();
  if (venueType) filter.venueType = venueType;
  if (city) filter.city = new RegExp(`^${escapeRegex(city.trim())}$`, "i");
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (isPublished !== undefined) filter.isPublished = isPublished === "true";
  if (search?.trim()) {
    const r = rx(search);
    filter.$or = [{ name: r }, { city: r }, { address: r }];
  }

  const [items, total] = await Promise.all([
    NightClub.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-images -videos -description -cancellationPolicy -refundPolicy -entryPolicy")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    NightClub.countDocuments(filter),
  ]);

  const ids = items.map((c) => c._id);
  const [eventAgg, tableAgg] = ids.length
    ? await Promise.all([
        NightClubEvent.aggregate([
          { $match: { nightClubId: { $in: ids } } },
          { $group: { _id: "$nightClubId", events: { $sum: 1 } } },
        ]),
        NightClubTable.aggregate([
          { $match: { nightClubId: { $in: ids } } },
          { $group: { _id: "$nightClubId", tables: { $sum: 1 } } },
        ]),
      ])
    : [[], []];

  const eMap = new Map(eventAgg.map((e) => [String(e._id), e.events]));
  const tMap = new Map(tableAgg.map((e) => [String(e._id), e.tables]));

  const data = items.map((c) => ({
    ...c,
    eventCount: eMap.get(String(c._id)) || 0,
    tableCount: tMap.get(String(c._id)) || 0,
  }));

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

export const getClubById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid club id");

  const club = await NightClub.findById(id).populate("vendorId", VENDOR_FIELDS).lean();
  if (!club) return fail(res, 404, "NOT_FOUND", "Night club not found");

  const [events, tables, eventStatusAgg] = await Promise.all([
    NightClubEvent.find({ nightClubId: club._id })
      .sort({ eventDate: -1 })
      .limit(20)
      .select("title eventType eventDate startTime endTime status isPublished totalCapacity bannerImage")
      .lean(),
    NightClubTable.find({ nightClubId: club._id }).sort({ tableNumber: 1 }).lean(),
    NightClubEvent.aggregate([
      { $match: { nightClubId: club._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  res.json({ success: true, data: { ...club, events, tables, eventStatusBreakdown: eventStatusAgg } });
});

export const updateClubStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const status = String(req.body?.status || "").toLowerCase();
  const reason = String(req.body?.rejectionReason || "").trim();

  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid club id");
  if (!CLUB_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${CLUB_STATUSES.join(", ")}`);
  }
  if (status === "rejected" && !reason) {
    return fail(res, 400, "REASON_REQUIRED", "rejectionReason is required when rejecting");
  }

  const update = { $set: { status } };
  if (status !== "approved") update.$set.isPublished = false; // approved nahi to live nahi
  if (status === "rejected") update.$set.rejectionReason = reason.slice(0, 300);
  else update.$unset = { rejectionReason: "" };

  const club = await NightClub.findByIdAndUpdate(id, update, { new: true });
  if (!club) return fail(res, 404, "NOT_FOUND", "Night club not found");

  res.json({ success: true, message: `Night club ${status}`, data: club });
});

export const setClubPublish = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid club id");
  if (req.body?.isPublished === undefined) {
    return fail(res, 400, "INVALID_BODY", "isPublished (true/false) is required");
  }

  const publish = bool(req.body.isPublished);
  const club = await NightClub.findById(id);
  if (!club) return fail(res, 404, "NOT_FOUND", "Night club not found");
  if (publish && club.status !== "approved") {
    return fail(res, 400, "NOT_APPROVED", "Night club must be approved before publishing");
  }

  const updated = await NightClub.findByIdAndUpdate(id, { isPublished: publish }, { new: true });
  res.json({ success: true, message: publish ? "Night club published" : "Night club unpublished", data: updated });
});

/* =====================================================================
 * EVENTS
 * ===================================================================== */
export const listEvents = wrap(async (req, res) => {
  const { search, status, eventType, nightClubId, vendor, city, isPublished, upcoming, from, to, sort } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (status) filter.status = String(status).toLowerCase();
  if (eventType) filter.eventType = eventType;
  if (nightClubId) {
    if (!isValidId(nightClubId)) return fail(res, 400, "INVALID_ID", "Invalid nightClubId");
    filter.nightClubId = nightClubId;
  }
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (isPublished !== undefined) filter.isPublished = isPublished === "true";

  if (city && !filter.nightClubId) {
    const clubIds = await NightClub.distinct("_id", { city: new RegExp(`^${escapeRegex(city.trim())}$`, "i") });
    filter.nightClubId = { $in: clubIds };
  }

  if (upcoming === "true") filter.eventDate = { $gte: utcToday(new Date()) };
  else if (upcoming === "false") filter.eventDate = { $lt: utcToday(new Date()) };
  if (from || to) {
    filter.eventDate = { ...(filter.eventDate || {}) };
    if (from) filter.eventDate.$gte = new Date(from);
    if (to) filter.eventDate.$lte = new Date(to);
  }

  if (search?.trim()) {
    const r = rx(search);
    filter.$or = [{ title: r }, { artistName: r }, { djName: r }, { hostName: r }];
  }

  const sortMap = { dateAsc: { eventDate: 1 }, dateDesc: { eventDate: -1 }, oldest: { createdAt: 1 } };

  const [items, total] = await Promise.all([
    NightClubEvent.find(filter)
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-description -images -videos -entryPolicy")
      .populate("nightClubId", CLUB_FIELDS)
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    NightClubEvent.countDocuments(filter),
  ]);

  const ids = items.map((e) => e._id);
  const [ticketAgg, bookingAgg] = ids.length
    ? await Promise.all([
        NightClubEventTicket.aggregate([
          { $match: { eventId: { $in: ids } } },
          {
            $group: {
              _id: "$eventId",
              ticketTypes: { $sum: 1 },
              totalQuantity: { $sum: "$totalQuantity" },
              soldQuantity: { $sum: "$soldQuantity" },
            },
          },
        ]),
        NightClubEventBooking.aggregate([
          { $match: { eventId: { $in: ids } } },
          {
            $group: {
              _id: "$eventId",
              totalBookings: { $sum: 1 },
              confirmed: { $sum: { $cond: [{ $eq: ["$bookingStatus", "confirmed"] }, 1, 0] } },
              checkedIn: { $sum: { $cond: [{ $eq: ["$entryStatus", "checked_in"] }, 1, 0] } },
              revenue: {
                $sum: {
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
                },
              },
            },
          },
        ]),
      ])
    : [[], []];

  const tMap = new Map(ticketAgg.map((t) => [String(t._id), t]));
  const bMap = new Map(bookingAgg.map((b) => [String(b._id), b]));

  const data = items.map((e) => {
    const t = tMap.get(String(e._id));
    const b = bMap.get(String(e._id));
    return {
      ...e,
      ticketStats: {
        ticketTypes: t?.ticketTypes || 0,
        totalQuantity: t?.totalQuantity || 0,
        soldQuantity: t?.soldQuantity || 0,
      },
      bookingStats: {
        totalBookings: b?.totalBookings || 0,
        confirmed: b?.confirmed || 0,
        checkedIn: b?.checkedIn || 0,
        revenue: b?.revenue || 0,
      },
    };
  });

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

export const getEventById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid event id");

  const event = await NightClubEvent.findById(id)
    .populate("nightClubId")
    .populate("vendorId", VENDOR_FIELDS)
    .lean();
  if (!event) return fail(res, 404, "NOT_FOUND", "Event not found");

  const [tickets, tablePricing, bookingAgg, entryAgg] = await Promise.all([
    NightClubEventTicket.find({ eventId: event._id }).sort({ createdAt: 1 }).lean(),
    NightClubTablePricing.find({ eventId: event._id })
      .populate("tableId", "tableNumber tableName tableType capacity floor section")
      .sort({ createdAt: -1 })
      .lean(),
    NightClubEventBooking.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: "$bookingStatus",
          count: { $sum: 1 },
          persons: { $sum: "$totalPersons" },
          amount: { $sum: "$totalAmount" },
        },
      },
    ]),
    NightClubEventBooking.aggregate([
      { $match: { eventId: event._id } },
      { $group: { _id: "$entryStatus", count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      ...event,
      tickets: tickets,
      tablePricing,
      bookingStats: bookingAgg,
      entryStats: entryAgg,
    },
  });
});

export const updateEventStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const status = String(req.body?.status || "").toLowerCase();
  const reason = String(req.body?.rejectionReason || "").trim();

  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid event id");
  if (!EVENT_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${EVENT_STATUSES.join(", ")}`);
  }
  if (status === "rejected" && !reason) {
    return fail(res, 400, "REASON_REQUIRED", "rejectionReason is required when rejecting");
  }

  const update = { $set: { status } };
  if (status !== "approved") update.$set.isPublished = false;
  if (status === "rejected") update.$set.rejectionReason = reason.slice(0, 300);
  else update.$unset = { rejectionReason: "" };

  const event = await NightClubEvent.findByIdAndUpdate(id, update, { new: true });
  if (!event) return fail(res, 404, "NOT_FOUND", "Event not found");

  res.json({ success: true, message: `Event ${status}`, data: event });
});

export const setEventPublish = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid event id");
  if (req.body?.isPublished === undefined) {
    return fail(res, 400, "INVALID_BODY", "isPublished (true/false) is required");
  }

  const publish = bool(req.body.isPublished);
  const event = await NightClubEvent.findById(id);
  if (!event) return fail(res, 404, "NOT_FOUND", "Event not found");
  if (publish && event.status !== "approved") {
    return fail(res, 400, "NOT_APPROVED", "Event must be approved before publishing");
  }

  const updated = await NightClubEvent.findByIdAndUpdate(id, { isPublished: publish }, { new: true });
  res.json({ success: true, message: publish ? "Event published" : "Event unpublished", data: updated });
});

export const getEventTickets = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid event id");

  const data = await NightClubEventTicket.find({ eventId: id }).sort({ createdAt: 1 }).lean();
  res.json({ success: true, count: data.length, data });
});

export const getEventTables = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid event id");

  const data = await NightClubTablePricing.find({ eventId: id })
    .populate("tableId", "tableNumber tableName tableType capacity floor section image")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, count: data.length, data });
});

export const getEventBookings = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid event id");

  const { page, limit, skip } = pageParams(req.query);
  const filter = { eventId: id };
  if (req.query.bookingStatus) filter.bookingStatus = String(req.query.bookingStatus).toLowerCase();

  const [data, total] = await Promise.all([
    NightClubEventBooking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    NightClubEventBooking.countDocuments(filter),
  ]);

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

/* =====================================================================
 * TICKETS
 * ===================================================================== */
export const listTickets = wrap(async (req, res) => {
  const { eventId, nightClubId, vendor, ticketType, isActive, isSoldOut, search } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (eventId) {
    if (!isValidId(eventId)) return fail(res, 400, "INVALID_ID", "Invalid eventId");
    filter.eventId = eventId;
  }
  if (nightClubId) {
    if (!isValidId(nightClubId)) return fail(res, 400, "INVALID_ID", "Invalid nightClubId");
    filter.nightClubId = nightClubId;
  }
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (ticketType) filter.ticketType = ticketType;
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (isSoldOut !== undefined) filter.isSoldOut = isSoldOut === "true";
  if (search?.trim()) filter.name = rx(search);

  const [data, total] = await Promise.all([
    NightClubEventTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("eventId", "title eventDate status isPublished")
      .populate("nightClubId", "name city")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    NightClubEventTicket.countDocuments(filter),
  ]);

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

export const toggleTicket = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid ticket id");

  const ticket = await NightClubEventTicket.findById(id);
  if (!ticket) return fail(res, 404, "NOT_FOUND", "Ticket not found");

  const updated = await NightClubEventTicket.findByIdAndUpdate(
    id,
    { isActive: !ticket.isActive },
    { new: true }
  );
  res.json({
    success: true,
    message: updated.isActive ? "Ticket activated" : "Ticket deactivated",
    data: updated,
  });
});

/* =====================================================================
 * TABLES (club inventory)
 * ===================================================================== */
export const listTables = wrap(async (req, res) => {
  const { nightClubId, tableType, isActive, isBookable, search } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (nightClubId) {
    if (!isValidId(nightClubId)) return fail(res, 400, "INVALID_ID", "Invalid nightClubId");
    filter.nightClubId = nightClubId;
  }
  if (tableType) filter.tableType = tableType;
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (isBookable !== undefined) filter.isBookable = isBookable === "true";
  if (search?.trim()) {
    const r = rx(search);
    filter.$or = [{ tableNumber: r }, { tableName: r }];
  }

  const [data, total] = await Promise.all([
    NightClubTable.find(filter)
      .sort({ nightClubId: 1, tableNumber: 1 })
      .skip(skip)
      .limit(limit)
      .populate("nightClubId", "name city")
      .lean(),
    NightClubTable.countDocuments(filter),
  ]);

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

export const toggleTable = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid table id");

  const table = await NightClubTable.findById(id);
  if (!table) return fail(res, 404, "NOT_FOUND", "Table not found");

  const next = !table.isActive;
  const updated = await NightClubTable.findByIdAndUpdate(
    id,
    { isActive: next, isBookable: next },
    { new: true }
  );
  res.json({ success: true, message: next ? "Table enabled" : "Table disabled", data: updated });
});

/* =====================================================================
 * TABLE PRICING (event wise)
 * ===================================================================== */
export const listTablePricing = wrap(async (req, res) => {
  const { eventId, nightClubId, vendor, isActive, isBookable, isSoldOut } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (eventId) {
    if (!isValidId(eventId)) return fail(res, 400, "INVALID_ID", "Invalid eventId");
    filter.eventId = eventId;
  }
  if (nightClubId) {
    if (!isValidId(nightClubId)) return fail(res, 400, "INVALID_ID", "Invalid nightClubId");
    filter.nightClubId = nightClubId;
  }
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (isBookable !== undefined) filter.isBookable = isBookable === "true";
  if (isSoldOut !== undefined) filter.isSoldOut = isSoldOut === "true";

  const [data, total] = await Promise.all([
    NightClubTablePricing.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("tableId", "tableNumber tableName tableType capacity floor section")
      .populate("eventId", "title eventDate")
      .populate("nightClubId", "name city")
      .lean(),
    NightClubTablePricing.countDocuments(filter),
  ]);

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

export const toggleTablePricing = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid pricing id");

  const pricing = await NightClubTablePricing.findById(id);
  if (!pricing) return fail(res, 404, "NOT_FOUND", "Table pricing not found");

  const updated = await NightClubTablePricing.findByIdAndUpdate(
    id,
    { isBookable: !pricing.isBookable },
    { new: true }
  );
  res.json({
    success: true,
    message: updated.isBookable ? "Table booking enabled" : "Table booking disabled",
    data: updated,
  });
});

/* =====================================================================
 * BOOKINGS
 * ===================================================================== */
export const listBookings = wrap(async (req, res) => {
  const {
    search, bookingStatus, paymentStatus, entryStatus,
    eventId, nightClubId, vendor, ticketType, from, to,
  } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (bookingStatus) filter.bookingStatus = String(bookingStatus).toLowerCase();
  if (paymentStatus) filter.paymentStatus = String(paymentStatus).toLowerCase();
  if (entryStatus) filter.entryStatus = entryStatus;
  if (ticketType) filter.ticketType = ticketType;
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (eventId) {
    if (!isValidId(eventId)) return fail(res, 400, "INVALID_ID", "Invalid eventId");
    filter.eventId = eventId;
  }
  if (nightClubId) {
    if (!isValidId(nightClubId)) return fail(res, 400, "INVALID_ID", "Invalid nightClubId");
    filter.nightClubId = nightClubId;
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (search?.trim()) {
    const r = rx(search);
    filter.$or = [{ bookingId: r }, { customerName: r }, { customerEmail: r }, { customerPhone: r }];
  }

  const [data, total, summaryAgg] = await Promise.all([
    NightClubEventBooking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-qrCode -razorpaySignature")
      .populate("eventId", EVENT_FIELDS)
      .populate("nightClubId", "name city")
      .populate("vendorId", VENDOR_FIELDS)
      .populate("userId", USER_FIELDS)
      .lean(),
    NightClubEventBooking.countDocuments(filter),
    NightClubEventBooking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$bookingStatus",
          count: { $sum: 1 },
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

// _id ya bookingId (NC-...) dono chalega
export const getBookingById = wrap(async (req, res) => {
  const { id } = req.params;
  const query = isValidId(id) ? { _id: id } : { bookingId: String(id).toUpperCase() };

  const booking = await NightClubEventBooking.findOne(query)
    .select("-razorpaySignature")
    .populate("eventId")
    .populate("nightClubId", "name city address phone logo coverImage")
    .populate("ticketId", "name ticketType price personsPerTicket")
    .populate("vendorId", VENDOR_FIELDS)
    .populate("userId", USER_FIELDS)
    .lean();
  if (!booking) return fail(res, 404, "NOT_FOUND", "Booking not found");

  res.json({ success: true, data: booking });
});

/* Admin override:
 *   pending   -> cancelled
 *   confirmed -> cancelled | completed
 *   cancelled -> refunded   (sirf jab paymentStatus = paid; refund Razorpay se alag hota hai,
 *                            ye sirf record update hai)
 * Ticket inventory yahan touch nahi hoti (vendor side payment module sambhalta hai).
 */
const TRANSITIONS = {
  pending: ["cancelled"],
  confirmed: ["cancelled", "completed"],
  cancelled: ["refunded"],
};

export const updateBookingStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const status = String(req.body?.bookingStatus || req.body?.status || "").toLowerCase();
  const reason = String(req.body?.reason || "").trim().slice(0, 300);

  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid booking id");
  if (!EVENT_BOOKING_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${EVENT_BOOKING_STATUSES.join(", ")}`);
  }

  const booking = await NightClubEventBooking.findById(id);
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

  const set = { bookingStatus: status };
  if (status === "cancelled") {
    set.cancelledAt = new Date();
    set.cancellationReason = `Admin: ${reason}`;
  }
  if (status === "refunded") set.paymentStatus = "refunded";

  // Atomic: beech me status badal gaya to update nahi hoga
  const updated = await NightClubEventBooking.findOneAndUpdate(
    { _id: booking._id, bookingStatus: booking.bookingStatus },
    { $set: set },
    { new: true }
  );
  if (!updated) return fail(res, 409, "STATUS_CHANGED", "Booking status changed, please refresh");

  res.json({ success: true, message: `Booking ${status}`, data: updated });
});