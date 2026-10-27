/**
 * Change Calendar Controller
 */

import { ChangeCalendar } from "../models/ChangeCalendar.js";

/* =========================================================
   API 1: STATS (4 top cards)
   ========================================================= */

export const getStats = async (req, res) => {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // 1. This Week
  const thisWeek = await ChangeCalendar.countDocuments({
    windowStart: { $gte: weekStart },
    active: true,
    isBlackout: false,
  });

  // 2. Conflicts
  const conflicts = await ChangeCalendar.countDocuments({
    hasConflict: true,
    active: true,
  });

  // 3. Blackout Windows
  const blackoutWindows = await ChangeCalendar.countDocuments({
    isBlackout: true,
    active: true,
  });

  // 4. Success Rate
  const totalCompleted = await ChangeCalendar.countDocuments({
    status: "Completed",
    active: true,
  });
  const successRate = 98.7; // placeholder - actual calculation from logs

  res.json({
    success: true,
    data: {
      thisWeek: {
        value: thisWeek,
        subValue: "Production changes",
      },
      conflicts: {
        value: conflicts,
        subValue: "Must resolve before approval",
      },
      blackoutWindows: {
        value: blackoutWindows,
        subValue: "Finance + peak commerce",
      },
      successRate: {
        value: `${successRate}%`,
        numericValue: successRate,
        subValue: "Rolling 90 days",
      },
    },
  });
};

/* =========================================================
   API 2: LIST (Changes)
   ========================================================= */

export const getList = async (req, res) => {
  const { status = "", risk = "" } = req.query;

  const query = { active: true, isBlackout: false };
  if (status && status !== "All") query.status = status;
  if (risk && risk !== "All") query.risk = risk;

  const changes = await ChangeCalendar.find(query)
    .sort({ windowStart: 1 })
    .limit(50)
    .lean();

  res.json({
    success: true,
    data: {
      items: changes.map((c) => ({
        id: String(c._id),
        changeId: c.changeId,
        title: c.title,
        service: c.service,
        environment: c.environment,
        owner: c.owner,
        risk: c.risk,
        status: c.status,
        windowStart: c.windowStart,
        windowEnd: c.windowEnd,
        hasConflict: c.hasConflict,
        conflictType: c.conflictType,
        conflictMessage: c.conflictMessage,
      })),
      total: changes.length,
    },
  });
};

/* =========================================================
   API 3: BLACKOUT BANNERS
   ========================================================= */

export const getBlackouts = async (req, res) => {
  const blackouts = await ChangeCalendar.find({
    isBlackout: true,
    active: true,
  })
    .sort({ windowStart: 1 })
    .lean();

  res.json({
    success: true,
    data: {
      items: blackouts.map((b) => ({
        id: String(b._id),
        title: b.title,
        reason: b.blackoutReason,
        windowStart: b.windowStart,
        windowEnd: b.windowEnd,
      })),
    },
  });
};

/* =========================================================
   API 4: SINGLE CHANGE (Detail panel)
   ========================================================= */

export const getOne = async (req, res) => {
  const change = await ChangeCalendar.findById(req.params.id).lean();

  if (!change) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Change not found" },
    });
  }

  res.json({
    success: true,
    data: {
      id: String(change._id),
      changeId: change.changeId,
      title: change.title,
      service: change.service,
      environment: change.environment,
      owner: change.owner,
      risk: change.risk,
      status: change.status,
      windowStart: change.windowStart,
      windowEnd: change.windowEnd,
      conflictAnalysis: change.conflictAnalysis,
      rollbackPlan: change.rollbackPlan,
      description: change.description,
      hasConflict: change.hasConflict,
      conflictMessage: change.conflictMessage,
    },
  });
};

/* =========================================================
   API 5: APPROVE
   ========================================================= */

export const approve = async (req, res) => {
  const change = await ChangeCalendar.findById(req.params.id);
  if (!change) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Change not found" },
    });
  }

  if (change.hasConflict) {
    return res.status(400).json({
      success: false,
      error: {
        code: "HAS_CONFLICT",
        message: "Resolve conflicts before approval",
      },
    });
  }

  change.status = "Approved";
  await change.save();

  res.json({
    success: true,
    data: {
      message: "Change approved",
      change: {
        id: String(change._id),
        changeId: change.changeId,
        status: change.status,
      },
    },
  });
};

/* =========================================================
   API 6: REJECT
   ========================================================= */

export const reject = async (req, res) => {
  const change = await ChangeCalendar.findById(req.params.id);
  if (!change) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Change not found" },
    });
  }

  change.status = "Rejected";
  await change.save();

  res.json({
    success: true,
    data: {
      message: "Change rejected",
      change: {
        id: String(change._id),
        changeId: change.changeId,
        status: change.status,
      },
    },
  });
};

/* =========================================================
   API 7: CREATE (Single ya Array - "New change" button)
   ========================================================= */

export const create = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.changeId || !item.title || !item.windowStart || !item.windowEnd) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATA",
          message: "changeId, title, windowStart, windowEnd required",
        },
      });
    }
  }

  const changes = await ChangeCalendar.insertMany(
    items.map((item) => ({
      changeId: item.changeId,
      title: item.title,
      service: item.service,
      environment: item.environment || "Production",
      owner: item.owner,
      risk: item.risk || "Medium",
      status: item.status || "Scheduled",
      windowStart: new Date(item.windowStart),
      windowEnd: new Date(item.windowEnd),
      conflictAnalysis: item.conflictAnalysis || "None",
      rollbackPlan: item.rollbackPlan,
      description: item.description,
      hasConflict: item.hasConflict || false,
      conflictType: item.conflictType,
      conflictMessage: item.conflictMessage,
      isBlackout: item.isBlackout || false,
      blackoutReason: item.blackoutReason,
      active: true,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${changes.length} change(s) created`,
      count: changes.length,
      changes: changes.map((c) => ({
        id: String(c._id),
        changeId: c.changeId,
        title: c.title,
        status: c.status,
      })),
    },
  });
};

/* =========================================================
   API 8: DELETE (Soft)
   ========================================================= */

export const remove = async (req, res) => {
  const change = await ChangeCalendar.findById(req.params.id);
  if (!change) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Change not found" },
    });
  }

  change.active = false;
  await change.save();

  res.json({
    success: true,
    data: { message: "Change removed" },
  });
};