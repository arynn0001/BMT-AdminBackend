/**
 * Postmortem Controller
 */

import { Postmortem } from "../models/Postmortem.js";

/* =========================================================
   API 1: STATS (4 top cards)
   ========================================================= */

export const getStats = async (req, res) => {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  // 1. Due this week
  const dueThisWeek = await Postmortem.countDocuments({
    dueDate: { $lte: weekEnd, $gte: now },
    status: { $ne: "Approved" },
    active: true,
  });

  // 2. Actions Open (sum across all postmortems)
  const allPostmortems = await Postmortem.find({ active: true }).lean();
  let actionsOpen = 0;
  allPostmortems.forEach((p) => {
    actionsOpen += (p.actions || []).filter((a) => !a.done).length;
  });

  // 3. Repeat Incidents (percentage) - static for now
  const repeatIncidents = 1.8;

  // 4. On-time Closure (%)
  const totalPostmortems = allPostmortems.length;
  const approvedPostmortems = allPostmortems.filter(
    (p) => p.status === "Approved" || p.status === "Closed"
  ).length;
  const onTimeClosure =
    totalPostmortems > 0
      ? Math.round((approvedPostmortems / totalPostmortems) * 1000) / 10
      : 93.6;

  res.json({
    success: true,
    data: {
      dueThisWeek: {
        value: dueThisWeek,
        subValue: "Linked to resolved incidents",
      },
      actionsOpen: {
        value: actionsOpen,
        subValue: "Named owner + due date",
      },
      repeatIncidents: {
        value: `${repeatIncidents}%`,
        numericValue: repeatIncidents,
        subValue: "Rolling 90 days",
      },
      onTimeClosure: {
        value: `${onTimeClosure}%`,
        numericValue: onTimeClosure,
        subValue: "Approved reviews",
      },
    },
  });
};

/* =========================================================
   API 2: LIST (Postmortems)
   ========================================================= */

export const getList = async (req, res) => {
  const { status = "" } = req.query;

  const query = { active: true };
  if (status && status !== "All") query.status = status;

  const postmortems = await Postmortem.find(query)
    .sort({ dueDate: 1 })
    .limit(50)
    .lean();

  res.json({
    success: true,
    data: {
      items: postmortems.map((p) => {
        const totalActions = (p.actions || []).length;
        const doneActions = (p.actions || []).filter((a) => a.done).length;
        const progress =
          totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0;

        return {
          id: String(p._id),
          postmortemId: p.postmortemId,
          incidentId: p.incidentId,
          title: p.title,
          owner: p.owner,
          dueDate: p.dueDate,
          status: p.status,
          impact: p.impact,
          actionsTotal: totalActions,
          actionsDone: doneActions,
          progress,
          createdAt: p.createdAt,
        };
      }),
      total: postmortems.length,
    },
  });
};

/* =========================================================
   API 3: SINGLE POSTMORTEM (Detail panel)
   ========================================================= */

export const getOne = async (req, res) => {
  const pm = await Postmortem.findById(req.params.id).lean();

  if (!pm) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Postmortem not found" },
    });
  }

  res.json({
    success: true,
    data: {
      id: String(pm._id),
      postmortemId: pm.postmortemId,
      incidentId: pm.incidentId,
      title: pm.title,
      owner: pm.owner,
      dueDate: pm.dueDate,
      status: pm.status,
      impact: pm.impact,
      detection: pm.detection,
      cause: pm.cause,
      lessons: pm.lessons,
      actions: pm.actions || [],
      approvedAt: pm.approvedAt,
      approvedBy: pm.approvedBy,
      createdAt: pm.createdAt,
    },
  });
};

/* =========================================================
   API 4: CREATE (Single ya Array)
   ========================================================= */

export const create = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.postmortemId || !item.incidentId || !item.title || !item.dueDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATA",
          message: "postmortemId, incidentId, title, dueDate required",
        },
      });
    }
  }

  const postmortems = await Postmortem.insertMany(
    items.map((item) => ({
      postmortemId: item.postmortemId,
      incidentId: item.incidentId,
      title: item.title,
      owner: item.owner,
      ownerEmail: item.ownerEmail,
      dueDate: new Date(item.dueDate),
      status: item.status || "Draft",
      impact: item.impact,
      detection: item.detection,
      cause: item.cause,
      lessons: item.lessons,
      actions: item.actions || [
        {
          text: "Review incident and identify preventative action",
          owner: item.owner,
          dueDate: new Date(item.dueDate),
          done: false,
        },
      ],
      active: true,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${postmortems.length} postmortem(s) created`,
      count: postmortems.length,
      postmortems: postmortems.map((p) => ({
        id: String(p._id),
        postmortemId: p.postmortemId,
        title: p.title,
        status: p.status,
      })),
    },
  });
};

/* =========================================================
   API 5: UPDATE ACTIONS (Checklist)
   ========================================================= */

export const updateActions = async (req, res) => {
  const { actions } = req.body;

  const pm = await Postmortem.findById(req.params.id);
  if (!pm) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Postmortem not found" },
    });
  }

  if (Array.isArray(actions)) {
    pm.actions = actions;
  }

  await pm.save();

  res.json({
    success: true,
    data: {
      message: "Actions updated",
      postmortem: {
        id: String(pm._id),
        postmortemId: pm.postmortemId,
        actions: pm.actions,
      },
    },
  });
};

/* =========================================================
   API 6: APPROVE & CLOSE
   ========================================================= */

export const approve = async (req, res) => {
  const pm = await Postmortem.findById(req.params.id);
  if (!pm) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Postmortem not found" },
    });
  }

  // Check: all actions must be done
  const pendingActions = (pm.actions || []).filter((a) => !a.done);
  if (pendingActions.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "PENDING_ACTIONS",
        message: `${pendingActions.length} preventative action(s) still open`,
      },
    });
  }

  if (pm.status === "Approved") {
    return res.status(400).json({
      success: false,
      error: { code: "ALREADY_APPROVED", message: "Already approved" },
    });
  }

  pm.status = "Approved";
  pm.approvedAt = new Date();
  pm.approvedBy = {
    userId: req.user._id,
    name: req.user.name,
  };
  await pm.save();

  res.json({
    success: true,
    data: {
      message: "Postmortem approved and closed",
      postmortem: {
        id: String(pm._id),
        postmortemId: pm.postmortemId,
        status: pm.status,
      },
    },
  });
};

/* =========================================================
   API 7: DELETE (Soft)
   ========================================================= */

export const remove = async (req, res) => {
  const pm = await Postmortem.findById(req.params.id);
  if (!pm) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Postmortem not found" },
    });
  }

  pm.active = false;
  await pm.save();

  res.json({
    success: true,
    data: { message: "Postmortem removed" },
  });
};