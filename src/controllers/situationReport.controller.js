/**
 * Situation Report Controller
 */

import { SituationReport } from "../models/SituationReport.js";

/* =========================================================
   STATIC SECTION VALUES (Real data ke liye modify karo)
   ========================================================= */

const SECTION_VALUES = {
  "Executive summary": "Controlled attention",
  "Commerce": "₹4.82 Cr GBV",
  "Traveller operations": "8,418 active",
  "Supply": "68.4% direct",
  "Money": "₹3.96 Cr captured",
  "Customer care": "94.7% SLA",
  "Reliability": "99.92% available",
  "Approvals": "28 open",
  "Incidents": "3 active",
  "Changes": "3 scheduled",
  "Risks": "11 high-risk cases",
};

const ALL_SECTIONS = Object.keys(SECTION_VALUES);

/* =========================================================
   API 1: GET SECTIONS (Available sections list)
   ========================================================= */

export const getSections = async (req, res) => {
  res.json({
    success: true,
    data: {
      sections: ALL_SECTIONS,
    },
  });
};

/* =========================================================
   API 2: PREVIEW (Live briefing preview)
   ========================================================= */

export const getPreview = async (req, res) => {
  const { sections } = req.query;

  // Sections ko parse karo (comma separated) ya sab
  let selectedSections = ALL_SECTIONS;
  if (sections && typeof sections === "string") {
    selectedSections = sections.split(",").map((s) => s.trim());
  }

  const preview = selectedSections.map((section) => ({
    section,
    value: SECTION_VALUES[section] || "Included",
  }));

  res.json({
    success: true,
    data: {
      sections: preview,
      generatedAt: new Date(),
    },
  });
};

/* =========================================================
   API 3: LIST (Generated reports)
   ========================================================= */

export const getList = async (req, res) => {
  const reports = await SituationReport.find({ active: true })
    .sort({ generatedAt: -1 })
    .limit(50)
    .lean();

  res.json({
    success: true,
    data: {
      items: reports.map((r) => ({
        id: String(r._id),
        reportId: r.reportId,
        name: r.name,
        scope: r.scope,
        owner: r.owner,
        generatedAt: r.generatedAt,
        isScheduled: r.isScheduled,
      })),
      total: reports.length,
    },
  });
};

/* =========================================================
   API 4: SINGLE REPORT
   ========================================================= */

export const getOne = async (req, res) => {
  const report = await SituationReport.findById(req.params.id).lean();

  if (!report) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Report not found" },
    });
  }

  res.json({
    success: true,
    data: {
      id: String(report._id),
      reportId: report.reportId,
      name: report.name,
      sections: report.sections,
      scope: report.scope,
      content: report.content,
      owner: report.owner,
      generatedAt: report.generatedAt,
      isScheduled: report.isScheduled,
    },
  });
};

/* =========================================================
   API 5: GENERATE REPORT (Create & save)
   ========================================================= */

export const generate = async (req, res) => {
  const { name, sections } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_NAME", message: "Report name required" },
    });
  }

  const selectedSections = Array.isArray(sections) && sections.length > 0
    ? sections
    : ALL_SECTIONS;

  // Report content banao
  const lines = [
    `BirdMyTrip ${name}`,
    `Generated: ${new Date().toISOString()}`,
    `Owner: ${req.user.name}`,
    `Scope: ${selectedSections.join(" · ")}`,
    "",
    "Operational status: Controlled attention required",
    "",
  ];

  selectedSections.forEach((section) => {
    lines.push(`${section}: ${SECTION_VALUES[section] || "Included"}`);
  });

  const content = lines.join("\n");

  // Report ID generate karo
  const reportCount = await SituationReport.countDocuments();
  const reportId = `RPT-${3000 + reportCount + 1}`;

  const report = await SituationReport.create({
    reportId,
    name: name.trim(),
    sections: selectedSections,
    scope: selectedSections.join(" · "),
    content,
    owner: req.user.name,
    ownerEmail: req.user.email,
    generatedAt: new Date(),
    active: true,
  });

  res.status(201).json({
    success: true,
    data: {
      message: "Report generated and saved",
      report: {
        id: String(report._id),
        reportId: report.reportId,
        name: report.name,
        scope: report.scope,
        content: report.content,
        owner: report.owner,
        generatedAt: report.generatedAt,
      },
    },
  });
};

/* =========================================================
   API 6: SCHEDULE DELIVERY (Create scheduled report)
   ========================================================= */

export const schedule = async (req, res) => {
  const {
    name,
    sections,
    scheduleFrequency,
    outputFormat,
    nextRunAt,
  } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_NAME", message: "Report name required" },
    });
  }

  const selectedSections = Array.isArray(sections) && sections.length > 0
    ? sections
    : ALL_SECTIONS;

  const reportCount = await SituationReport.countDocuments();
  const reportId = `RPT-${3000 + reportCount + 1}`;

  const report = await SituationReport.create({
    reportId,
    name: name.trim(),
    sections: selectedSections,
    scope: selectedSections.join(" · "),
    content: "Scheduled report",
    owner: req.user.name,
    ownerEmail: req.user.email,
    isScheduled: true,
    scheduleFrequency: scheduleFrequency || "Run once",
    outputFormat: outputFormat || "TXT",
    nextRunAt: nextRunAt ? new Date(nextRunAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
    active: true,
  });

  res.status(201).json({
    success: true,
    data: {
      message: "Report scheduled",
      report: {
        id: String(report._id),
        reportId: report.reportId,
        name: report.name,
        isScheduled: true,
        scheduleFrequency: report.scheduleFrequency,
        outputFormat: report.outputFormat,
        nextRunAt: report.nextRunAt,
      },
    },
  });
};

/* =========================================================
   API 7: DELETE (Soft)
   ========================================================= */

export const remove = async (req, res) => {
  const report = await SituationReport.findById(req.params.id);
  if (!report) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Report not found" },
    });
  }

  report.active = false;
  await report.save();

  res.json({
    success: true,
    data: { message: "Report removed" },
  });
};