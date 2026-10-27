/**
 * Service Health Controller
 */

import { ServiceHealthCenter } from "../models/ServiceHealthCenter.js";

/* =========================================================
   API 1: STATS (4 top cards)
   ========================================================= */

export const getStats = async (req, res) => {
  // 1. Availability (30-day platform SLO) - static for now
  const availability = 99.92;

  // 2. Healthy Services
  const totalServices = await ServiceHealthCenter.countDocuments({ active: true });
  const healthyServices = await ServiceHealthCenter.countDocuments({
    status: "Healthy",
    active: true,
  });

  // 3. Error Budget - static for now
  const errorBudget = 71;

  // 4. Open Alerts - count of degraded/warning services
  const openAlerts = await ServiceHealthCenter.countDocuments({
    status: { $in: ["Warning", "Degraded", "Down"] },
    active: true,
  });

  res.json({
    success: true,
    data: {
      availability: {
        value: `${availability}%`,
        numericValue: availability,
        subValue: "30-day platform SLO",
      },
      healthyServices: {
        value: `${healthyServices}/${totalServices}`,
        healthy: healthyServices,
        total: totalServices,
        subValue: "Checked 12 seconds ago",
      },
      errorBudget: {
        value: `${errorBudget}%`,
        numericValue: errorBudget,
        subValue: "Monthly budget remaining",
      },
      openAlerts: {
        value: openAlerts,
        subValue: "2 require ownership",
      },
    },
  });
};

/* =========================================================
   API 2: LIST (Service cards)
   ========================================================= */

export const getList = async (req, res) => {
  const { status = "", category = "" } = req.query;

  const query = { active: true };
  if (status && status !== "All") query.status = status;
  if (category && category !== "All") query.category = category;

  const services = await ServiceHealthCenter.find(query)
    .sort({ status: 1, serviceName: 1 })
    .lean();

  res.json({
    success: true,
    data: {
      items: services.map((s) => ({
        id: String(s._id),
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        category: s.category,
        platform: s.platform,
        fullCategory: `${s.category} · ${s.platform}`,
        status: s.status,
        latency: `${s.latency} ms`,
        latencyValue: s.latency,
        traffic: `${(s.traffic / 1000).toFixed(1)}k rpm`,
        trafficValue: s.traffic,
        errors: `${s.errors}%`,
        errorsValue: s.errors,
        saturation: `${s.saturation}%`,
        saturationValue: s.saturation,
        market: s.market,
      })),
      total: services.length,
    },
  });
};

/* =========================================================
   API 3: SINGLE SERVICE
   ========================================================= */

export const getOne = async (req, res) => {
  const service = await ServiceHealthCenter.findById(req.params.id).lean();

  if (!service) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Service not found" },
    });
  }

  res.json({
    success: true,
    data: {
      id: String(service._id),
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      category: service.category,
      platform: service.platform,
      status: service.status,
      latency: `${service.latency} ms`,
      traffic: `${(service.traffic / 1000).toFixed(1)}k rpm`,
      errors: `${service.errors}%`,
      saturation: `${service.saturation}%`,
      market: service.market,
      createdAt: service.createdAt,
    },
  });
};

/* =========================================================
   API 4: CREATE (Single ya Array - Admin Panel Se)
   ========================================================= */

export const create = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.serviceId || !item.serviceName) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATA",
          message: "serviceId and serviceName required for all items",
        },
      });
    }
  }

  const services = await ServiceHealthCenter.insertMany(
    items.map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      category: item.category,
      platform: item.platform,
      status: item.status || "Healthy",
      latency: item.latency || 0,
      traffic: item.traffic || 0,
      errors: item.errors || 0,
      saturation: item.saturation || 0,
      market: item.market || "Production",
      active: true,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${services.length} service(s) created`,
      count: services.length,
      services: services.map((s) => ({
        id: String(s._id),
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        status: s.status,
      })),
    },
  });
};

/* =========================================================
   API 5: UPDATE SERVICE
   ========================================================= */

export const update = async (req, res) => {
  const { status, latency, traffic, errors, saturation } = req.body;

  const service = await ServiceHealthCenter.findById(req.params.id);
  if (!service) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Service not found" },
    });
  }

  if (status) service.status = status;
  if (latency !== undefined) service.latency = latency;
  if (traffic !== undefined) service.traffic = traffic;
  if (errors !== undefined) service.errors = errors;
  if (saturation !== undefined) service.saturation = saturation;

  await service.save();

  res.json({
    success: true,
    data: {
      message: "Service updated",
      service: {
        id: String(service._id),
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        status: service.status,
      },
    },
  });
};

/* =========================================================
   API 6: DELETE (Soft)
   ========================================================= */

export const remove = async (req, res) => {
  const service = await ServiceHealthCenter.findById(req.params.id);
  if (!service) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Service not found" },
    });
  }

  service.active = false;
  await service.save();

  res.json({
    success: true,
    data: { message: "Service removed" },
  });
};

/* =========================================================
   API 7: RUN CHECKS (Simulate health check)
   ========================================================= */

export const runChecks = async (req, res) => {
  // Sabhi services ki status check karo aur update karo
  const services = await ServiceHealthCenter.find({ active: true });

  for (const service of services) {
    // Simple logic: agar errors > 1% to Degraded, errors > 0.5% to Warning, warna Healthy
    if (service.errors >= 1.5) {
      service.status = "Degraded";
    } else if (service.errors >= 0.5) {
      service.status = "Warning";
    } else {
      service.status = "Healthy";
    }
    await service.save();
  }

  res.json({
    success: true,
    data: {
      message: `Checked ${services.length} services`,
      checkedAt: new Date(),
    },
  });
};