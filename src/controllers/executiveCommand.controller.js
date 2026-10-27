/**
 * Executive Command Controller
 * 
 * Dashboard ke saare APIs + data add karne ke endpoints.
 */

import {
  Vendor,
  Customer,
  Booking,
  ServiceHealth,
  CommandAction,
} from "../models/ExecutiveCommand.js";

function formatAmount(amount) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

/* =========================================================
   API 1: EXECUTIVE STATS
   ========================================================= */

export const getExecutiveStats = async (req, res) => {
  const gbvAgg = await Booking.aggregate([
    { $match: { status: { $in: ["confirmed", "completed"] }, active: true } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const gbv = gbvAgg[0]?.total || 0;

  const activeTravellers = await Customer.countDocuments({ active: true });

  const totalVendors = await Vendor.countDocuments({ active: true });
  const approvedVendors = await Vendor.countDocuments({
    status: "APPROVED",
    active: true,
  });
  const bmtDirectShare =
    totalVendors > 0
      ? Math.round((approvedVendors / totalVendors) * 1000) / 10
      : 0;

  const pendingApprovals = await Vendor.countDocuments({ status: "PENDING" });
  const criticalCount = await CommandAction.countDocuments({
    priority: "P0",
    resolved: false,
  });

  res.json({
    success: true,
    data: {
      grossBookingValue: {
        value: gbv,
        formatted: formatAmount(gbv),
        change: 17.8,
      },
      activeTravellers: {
        value: activeTravellers,
        inService: 0,
      },
      bmtDirectShare: { value: bmtDirectShare },
      commandActions: {
        value: pendingApprovals + criticalCount,
        critical: criticalCount,
        approvals: pendingApprovals,
      },
    },
  });
};

/* =========================================================
   API 2: MODULE CARDS
   ========================================================= */

export const getModuleCards = async (req, res) => {
  const totalBookings = await Booking.countDocuments({ active: true });
  const confirmedBookings = await Booking.countDocuments({
    status: "confirmed",
    active: true,
  });
  const commerceConfirmed =
    totalBookings > 0
      ? Math.round((confirmedBookings / totalBookings) * 1000) / 10
      : 0;

  const liveProducts = await Vendor.countDocuments({
    status: "APPROVED",
    active: true,
  });

  const moneyAgg = await Booking.aggregate([
    { $match: { status: { $in: ["confirmed", "completed"] }, active: true } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const capturedAmount = moneyAgg[0]?.total || 0;

  const pendingBookings = await Booking.countDocuments({ status: "pending" });
  const degradedServices = await ServiceHealth.countDocuments({
    status: { $in: ["Degraded", "Down", "Warning"] },
  });

  res.json({
    success: true,
    data: {
      commerce: {
        title: "Commerce",
        value: `${totalBookings} bookings`,
        subValue: `${commerceConfirmed}% confirmed`,
        progress: commerceConfirmed,
      },
      supply: {
        title: "Supply",
        value: `${liveProducts} live products`,
        subValue: `${liveProducts} approved vendors`,
        progress: 85,
      },
      money: {
        title: "Money",
        value: `${formatAmount(capturedAmount)} captured`,
        subValue: `${pendingBookings} pending`,
        progress: 72,
      },
      customerCare: {
        title: "Customer care",
        value: `0 conversations`,
        subValue: `0% inside SLA`,
        progress: 0,
      },
      risk: {
        title: "Risk",
        value: `${formatAmount(pendingBookings * 15000)} exposure`,
        subValue: `${pendingBookings} high-risk cases`,
        progress: 45,
      },
      technology: {
        title: "Technology",
        value: `${degradedServices} degraded services`,
        subValue: `99.92% platform availability`,
        progress: 99.92,
      },
    },
  });
};

/* =========================================================
   API 3: SERVICE HEALTH (GET)
   ========================================================= */

export const getServiceHealth = async (req, res) => {
  const services = await ServiceHealth.find().sort({ createdAt: 1 }).lean();

  res.json({
    success: true,
    data: {
      items: services.map((s) => ({
        id: String(s._id),
        service: s.serviceName,
        category: s.category,
        status: s.status,
        latency: `${s.latency} ms`,
        traffic: `${(s.traffic / 1000).toFixed(1)}k rpm`,
        errors: `${s.errors}%`,
        saturation: s.saturation,
      })),
    },
  });
};

/* =========================================================
   API 4: COMMAND NOW (GET)
   ========================================================= */

export const getCommandNow = async (req, res) => {
  const actions = await CommandAction.find({ resolved: false })
    .sort({ priority: 1, createdAt: -1 })
    .limit(10)
    .lean();

  res.json({
    success: true,
    data: {
      items: actions.map((a) => ({
        id: String(a._id),
        priority: a.priority,
        title: a.title,
        category: a.category,
        timeAgo: a.timeAgo,
      })),
    },
  });
};

/* =========================================================
   API 5: OPERATING CONTROLS
   ========================================================= */

export const getOperatingControls = async (req, res) => {
  const pendingApprovals = await Vendor.countDocuments({ status: "PENDING" });
  const criticalIncidents = await CommandAction.countDocuments({
    priority: "P0",
    resolved: false,
  });

  res.json({
    success: true,
    data: {
      items: [
        {
          id: "approval-center",
          title: "Approval Center",
          value: `${pendingApprovals} Open`,
          route: "/admin/approvals",
        },
        {
          id: "incident-command",
          title: "Incident Command",
          value: `${criticalIncidents} Critical`,
          route: "/admin/incidents",
        },
        {
          id: "change-calendar",
          title: "Change Calendar",
          value: `0 Conflicts`,
          route: "/admin/change-calendar",
        },
        {
          id: "shift-handovers",
          title: "Shift Handovers",
          value: `0 Pending`,
          route: "/admin/handovers",
        },
      ],
    },
  });
};

/* =========================================================
   API 6: CREATE CUSTOMER (Single ya Array)
   ========================================================= */

export const createCustomer = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.name || item.name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_NAME", message: "Name required for all items" },
      });
    }
  }

  const customers = await Customer.insertMany(
    items.map((item) => ({
      name: item.name.trim(),
      email: item.email?.toLowerCase(),
      phone: item.phone,
      city: item.city,
      country: item.country || "India",
      active: true,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${customers.length} customer(s) created`,
      count: customers.length,
      customers: customers.map((c) => ({
        id: String(c._id),
        name: c.name,
        email: c.email,
        city: c.city,
      })),
    },
  });
};

/* =========================================================
   API 7: CREATE BOOKING (Single ya Array)
   ========================================================= */

export const createBooking = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.bookingId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_BOOKING_ID",
          message: "bookingId required for all items",
        },
      });
    }
  }

  const ids = items.map((i) => i.bookingId);
  const existing = await Booking.find({ bookingId: { $in: ids } });
  if (existing.length > 0) {
    return res.status(409).json({
      success: false,
      error: {
        code: "BOOKING_EXISTS",
        message: `Booking IDs already exist: ${existing.map((e) => e.bookingId).join(", ")}`,
      },
    });
  }

  const bookings = await Booking.insertMany(
    items.map((item) => ({
      bookingId: item.bookingId,
      customerId: item.customerId || undefined,
      customerName: item.customerName,
      customerEmail: item.customerEmail,
      vendorId: item.vendorId || undefined,
      vertical: item.vertical,
      status: item.status || "pending",
      amount: item.amount || 0,
      currency: item.currency || "INR",
      travelDate: item.travelDate ? new Date(item.travelDate) : undefined,
      active: true,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${bookings.length} booking(s) created`,
      count: bookings.length,
      bookings: bookings.map((b) => ({
        id: String(b._id),
        bookingId: b.bookingId,
        customerName: b.customerName,
        status: b.status,
        amount: b.amount,
      })),
    },
  });
};

/* =========================================================
   API 8: CREATE SERVICE HEALTH (Single ya Array)
   ========================================================= */

export const createServiceHealth = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.serviceName) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_NAME",
          message: "serviceName required for all items",
        },
      });
    }
  }

  const services = await ServiceHealth.insertMany(
    items.map((item) => ({
      serviceName: item.serviceName,
      category: item.category,
      status: item.status || "Healthy",
      latency: item.latency || 0,
      traffic: item.traffic || 0,
      errors: item.errors || 0,
      saturation: item.saturation || 0,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${services.length} service(s) created`,
      count: services.length,
      services: services.map((s) => ({
        id: String(s._id),
        serviceName: s.serviceName,
        status: s.status,
      })),
    },
  });
};

/* =========================================================
   API 9: CREATE COMMAND ACTION (Single ya Array)
   ========================================================= */

export const createCommandAction = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.title) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_TITLE",
          message: "title required for all items",
        },
      });
    }
  }

  const actions = await CommandAction.insertMany(
    items.map((item) => ({
      title: item.title,
      priority: item.priority || "P2",
      category: item.category,
      timeAgo: item.timeAgo,
      resolved: false,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${actions.length} action(s) created`,
      count: actions.length,
      actions: actions.map((a) => ({
        id: String(a._id),
        title: a.title,
        priority: a.priority,
      })),
    },
  });
};