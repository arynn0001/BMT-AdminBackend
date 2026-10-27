/**
 * My Work Controller
 * 
 * My Work page ke saare APIs.
 */

import { MyTask, Workspace, Shift, Completion } from "../models/MyWork.js";

/* =========================================================
   API 1: STATS (4 top cards)
   ========================================================= */

export const getStats = async (req, res) => {
  const userId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Assigned Now
  const assignedNow = await MyTask.countDocuments({
    assignedTo: userId,
    status: { $in: ["open", "in_progress"] },
    active: true,
  });

  // 2. Inside SLA (percentage of tasks within SLA)
  const totalTasks = await MyTask.countDocuments({
    assignedTo: userId,
    active: true,
  });
  const withinSla = await MyTask.countDocuments({
    assignedTo: userId,
    slaMinutes: { $gt: 0 },
    status: { $ne: "escalated" },
    active: true,
  });
  const insideSla =
    totalTasks > 0 ? Math.round((withinSla / totalTasks) * 1000) / 10 : 0;

  // 3. Completed Today
  const completedToday = await MyTask.countDocuments({
    assignedTo: userId,
    status: "completed",
    completedAt: { $gte: today },
  });

  // 4. Approval Authority
  const approvals = await MyTask.countDocuments({
    assignedTo: userId,
    category: /approval/i,
    status: { $ne: "completed" },
  });

  res.json({
    success: true,
    data: {
      assignedNow: {
        value: assignedNow,
        subValue: "Only your queues",
      },
      insideSla: {
        value: insideSla,
        subValue: "Rolling 7 days",
      },
      completedToday: {
        value: completedToday,
        subValue: "Median 11 minutes",
      },
      approvalAuthority: {
        value: "Unlimited",
        subValue: "maker-checker exceptions logged",
      },
    },
  });
};

/* =========================================================
   API 2: QUEUE (Operational Queue)
   ========================================================= */

export const getQueue = async (req, res) => {
  const userId = req.user._id;
  const { filter = "assigned" } = req.query;

  const query = { active: true };

  if (filter === "assigned") {
    query.assignedTo = userId;
    query.status = { $in: ["open", "in_progress"] };
  } else if (filter === "completed") {
    query.assignedTo = userId;
    query.status = "completed";
  }

  const tasks = await MyTask.find(query)
    .sort({ priority: 1, slaMinutes: 1 })
    .limit(20)
    .lean();

  res.json({
    success: true,
    data: {
      filter,
      count: tasks.length,
      items: tasks.map((t) => ({
        id: String(t._id),
        taskId: t.taskId,
        title: t.title,
        priority: t.priority,
        category: t.category,
        queue: t.queue,
        sla: `${t.slaMinutes} min`,
        slaMinutes: t.slaMinutes,
        status: t.status,
      })),
    },
  });
};

/* =========================================================
   API 3: WORKSPACES (Authorized Workspaces)
   ========================================================= */

export const getWorkspaces = async (req, res) => {
  const workspaces = await Workspace.find().sort({ order: 1 }).lean();

  res.json({
    success: true,
    data: {
      items: workspaces.map((w) => ({
        id: String(w._id),
        workspaceId: w.workspaceId,
        title: w.title,
        icon: w.icon,
        route: w.route,
      })),
    },
  });
};

/* =========================================================
   API 4: SHIFT (Shift & Handover)
   ========================================================= */

export const getShift = async (req, res) => {
  const userId = req.user._id;

  const shift = await Shift.findOne({
    userId,
    active: true,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!shift) {
    return res.json({
      success: true,
      data: {
        currentShift: null,
        message: "No active shift",
      },
    });
  }

  res.json({
    success: true,
    data: {
      currentShift: {
        id: String(shift._id),
        shiftName: shift.shiftName,
        status: shift.status,
        progress: shift.progress,
        startedAt: shift.startedAt,
      },
    },
  });
};

/* =========================================================
   API 5: RECENT COMPLETIONS
   ========================================================= */

export const getRecentCompletions = async (req, res) => {
  const userId = req.user._id;

  const completions = await Completion.find({ resolvedBy: userId })
    .sort({ completedAt: -1 })
    .limit(10)
    .lean();

  res.json({
    success: true,
    data: {
      count: completions.length,
      items: completions.map((c) => ({
        id: String(c._id),
        taskId: c.taskId,
        title: c.title,
        priority: c.priority,
        resolution: c.resolution,
        completedAt: c.completedAt,
      })),
    },
  });
};
/* =========================================================
   API 6: CREATE TASK (Single ya Array)
   ========================================================= */

export const createTask = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.taskId || !item.title) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATA",
          message: "taskId and title required for all items",
        },
      });
    }
  }

  const tasks = await MyTask.insertMany(
    items.map((item) => ({
      taskId: item.taskId,
      title: item.title,
      priority: item.priority || "Normal",
      category: item.category,
      queue: item.queue,
      slaMinutes: item.slaMinutes || 0,
      assignedTo: item.assignedTo || req.user._id,
      assignedToName: item.assignedToName || req.user.name,
      status: item.status || "open",
      active: true,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${tasks.length} task(s) created`,
      count: tasks.length,
      tasks: tasks.map((t) => ({
        id: String(t._id),
        taskId: t.taskId,
        title: t.title,
        priority: t.priority,
      })),
    },
  });
};

/* =========================================================
   API 7: CREATE WORKSPACE (Single ya Array)
   ========================================================= */

export const createWorkspace = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.workspaceId || !item.title) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATA",
          message: "workspaceId and title required for all items",
        },
      });
    }
  }

  const workspaces = await Workspace.insertMany(
    items.map((item) => ({
      workspaceId: item.workspaceId,
      title: item.title,
      icon: item.icon,
      route: item.route,
      order: item.order || 0,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${workspaces.length} workspace(s) created`,
      count: workspaces.length,
      workspaces: workspaces.map((w) => ({
        id: String(w._id),
        workspaceId: w.workspaceId,
        title: w.title,
      })),
    },
  });
};

/* =========================================================
   API 8: CREATE COMPLETION (Single ya Array)
   ========================================================= */

export const createCompletion = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.title) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATA",
          message: "title required for all items",
        },
      });
    }
  }

  const completions = await Completion.insertMany(
    items.map((item) => ({
      taskId: item.taskId,
      title: item.title,
      priority: item.priority,
      resolvedBy: item.resolvedBy || req.user._id,
      resolvedByName: item.resolvedByName || req.user.name,
      resolution: item.resolution,
      completedAt: item.completedAt ? new Date(item.completedAt) : new Date(),
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${completions.length} completion(s) created`,
      count: completions.length,
      completions: completions.map((c) => ({
        id: String(c._id),
        taskId: c.taskId,
        title: c.title,
        completedAt: c.completedAt,
      })),
    },
  });
};

/* =========================================================
   API 9: CREATE SHIFT (Single)
   ========================================================= */

export const createShift = async (req, res) => {
  const { shiftName, progress, status } = req.body;

  // Purani active shift band karo
  await Shift.updateMany(
    { userId: req.user._id, active: true },
    { $set: { active: false, status: "Ended", endedAt: new Date() } }
  );

  const shift = await Shift.create({
    userId: req.user._id,
    shiftName: shiftName || "Always-on privileged",
    status: status || "Active",
    progress: progress || 0,
    active: true,
  });

  res.status(201).json({
    success: true,
    data: {
      message: "Shift created",
      shift: {
        id: String(shift._id),
        shiftName: shift.shiftName,
        status: shift.status,
        progress: shift.progress,
      },
    },
  });
};