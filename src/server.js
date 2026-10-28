// /**
//  * Server Entry Point
//  *
//  * Server start karta hai - DB connect, Express setup, routes, listen.
//  */

// // DNS Override - Airtel DNS block bypass ke liye
// import dns from "node:dns";
// dns.setServers(["8.8.8.8", "8.8.4.4"]);
// dns.setDefaultResultOrder("ipv4first");

// import express from "express";
// import helmet from "helmet";
// import cors from "cors";
// import { rateLimit } from "express-rate-limit";
// import pinoHttp from "pino-http";
// import crypto from "node:crypto";

// import { env } from "./config/env.js";
// import { connectDatabase, disconnectDatabase } from "./config/database.js";
// import { logger } from "./utils/logger.js";
// import { errorHandler } from "./utils/errors.js";

// // Routes
// import authRoutes from "./routes/auth.routes.js";
// import executiveCommandRoutes from "./routes/executiveCommand.routes.js";
// import myWorkRoutes from "./routes/myWork.routes.js";
// import approvalRoutes from "./routes/approval.routes.js";
// import operationsInboxRoutes from "./routes/operationsInbox.routes.js";
// import liveIncidentRoutes from "./routes/liveIncident.routes.js";
// import serviceHealthRoutes from "./routes/serviceHealth.routes.js";
// import changeCalendarRoutes from "./routes/changeCalendar.routes.js";
// import shiftHandoverRoutes from "./routes/shiftHandover.routes.js";
// import postmortemRoutes from "./routes/postmortem.routes.js";
// import situationReportRoutes from "./routes/situationReport.routes.js";

// // 🚌 Bus
// import busRoutes from "./routes/bus.routes.js";

// // 🚕 Cab
// import cabRoutes from "./routes/cab.routes.js";

// // 📦 Packages
// import packagesRoutes from "./routes/packages.routes.js";

// // 🎯 Activities
// import activitiesRoutes from "./routes/activities.routes.js";

// // 🎟️ Events
// import eventsRoutes from "./routes/events.routes.js";

// // 🛕 Darshan
// import darshanRoutes from "./routes/darshan.routes.js";

// // 🚢 Cruises
// import cruiseRoutes from "./routes/cruise.routes.js";

// // 🏨 Stays (Hotel, Homestay, Motel, Apartment, Palace, Resort) - NEW
// import staysRoutes from "./routes/Stays.routes.js";

// async function startServer() {
//   // 1. Database connect
//   // NOTE: Vendor aur Admin same MongoDB use karte hain, isliye
//   // MONGO_URI dono me same hona chahiye (same database name ke saath).
//   await connectDatabase();

//   // 2. Express app
//   const app = express();

//   // Security
//   app.disable("x-powered-by");

//   // Helmet
//   app.use(
//     helmet({
//       contentSecurityPolicy: false,
//       crossOriginResourcePolicy: { policy: "cross-origin" },
//     })
//   );

//   // CORS
//   app.use(
//     cors({
//       origin: true,
//       credentials: true,
//       methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//       allowedHeaders: ["Content-Type", "Authorization"],
//     })
//   );

//   // Request logging
//   app.use(
//     pinoHttp({
//       logger,
//       genReqId: () => crypto.randomUUID(),
//       autoLogging: !env.isProduction,
//     })
//   );

//   // Rate limiting
//   app.use(
//     rateLimit({
//       windowMs: 60 * 1000,
//       limit: env.isProduction ? 100 : 10000,
//       standardHeaders: "draft-8",
//       legacyHeaders: false,
//       message: {
//         success: false,
//         error: {
//           code: "RATE_LIMITED",
//           message: "Too many requests, please try again later",
//         },
//       },
//     })
//   );

//   // Body parsing
//   app.use(express.json({ limit: "1mb" }));
//   app.use(express.urlencoded({ extended: true, limit: "1mb" }));

//   // Health check
//   app.get("/health/live", (_req, res) => {
//     res.json({ status: "ok", timestamp: new Date().toISOString() });
//   });

//   // =========================================================
//   // API Routes
//   // =========================================================
//   app.use("/auth", authRoutes);
//   app.use("/admin/dashboard", executiveCommandRoutes);
//   app.use("/admin/my-work", myWorkRoutes);
//   app.use("/admin/approvals", approvalRoutes);
//   app.use("/admin/operations-inbox", operationsInboxRoutes);
//   app.use("/admin/live-incidents", liveIncidentRoutes);
//   app.use("/admin/service-health", serviceHealthRoutes);
//   app.use("/admin/change-calendar", changeCalendarRoutes);
//   app.use("/admin/shift-handovers", shiftHandoverRoutes);
//   app.use("/admin/postmortems", postmortemRoutes);
//   app.use("/admin/situation-reports", situationReportRoutes);

//   // 🚌 Bus routes
//   app.use("/admin/bus", busRoutes);

//   // 🚕 Cab routes
//   app.use("/admin/cab", cabRoutes);

//   // 📦 Packages routes
//   app.use("/admin/packages", packagesRoutes);

//   // 🎯 Activities routes
//   app.use("/admin/activities", activitiesRoutes);

//   // 🎟️ Events routes
//   app.use("/admin/events", eventsRoutes);

//   // 🛕 Darshan routes
//   app.use("/admin/darshan", darshanRoutes);

//   // 🚢 Cruises routes
//   app.use("/admin/cruises", cruiseRoutes);

//   // 🏨 Stays routes (NEW)
//   app.use("/admin/stays", staysRoutes);

//   // 404
//   app.use((_req, res) => {
//     res.status(404).json({
//       success: false,
//       error: { code: "NOT_FOUND", message: "Route not found" },
//     });
//   });

//   // Error handler
//   app.use(errorHandler);

//   // 3. Listen
//   const server = app.listen(env.port, env.host, () => {
//     logger.info(`🚀 Server running on http://${env.host}:${env.port}`);
//     logger.info(`📝 Environment: ${env.nodeEnv}`);
//     logger.info(`🔗 Health: http://${env.host}:${env.port}/health/live`);
//   });

//   // 4. Graceful shutdown
//   const shutdown = async (signal) => {
//     logger.info(`${signal} received, shutting down...`);
//     server.close(async () => {
//       await disconnectDatabase();
//       logger.info("Server closed");
//       process.exit(0);
//     });
//     setTimeout(() => process.exit(1), 10000);
//   };

//   process.on("SIGTERM", () => shutdown("SIGTERM"));
//   process.on("SIGINT", () => shutdown("SIGINT"));
// }

// startServer().catch((error) => {
//   logger.error({ err: error }, "Failed to start server");
//   process.exit(1);
// });


/**
 * Server Entry Point
 * Express setup, database connection, CORS, routes and graceful shutdown.
 */


/**
 * BMT Admin Backend - Server Entry Point
 * Production CORS, MongoDB, routes and graceful shutdown.
 */

import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import "express-async-errors";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import crypto from "node:crypto";

import { env } from "./config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "./config/database.js";
import { logger } from "./utils/logger.js";
import { errorHandler } from "./utils/errors.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import executiveCommandRoutes from "./routes/executiveCommand.routes.js";
import myWorkRoutes from "./routes/myWork.routes.js";
import approvalRoutes from "./routes/approval.routes.js";
import operationsInboxRoutes from "./routes/operationsInbox.routes.js";
import liveIncidentRoutes from "./routes/liveIncident.routes.js";
import serviceHealthRoutes from "./routes/serviceHealth.routes.js";
import changeCalendarRoutes from "./routes/changeCalendar.routes.js";
import shiftHandoverRoutes from "./routes/shiftHandover.routes.js";
import postmortemRoutes from "./routes/postmortem.routes.js";
import situationReportRoutes from "./routes/situationReport.routes.js";

import busRoutes from "./routes/bus.routes.js";
import cabRoutes from "./routes/cab.routes.js";
import packagesRoutes from "./routes/packages.routes.js";
import activitiesRoutes from "./routes/activities.routes.js";
import eventsRoutes from "./routes/events.routes.js";
import darshanRoutes from "./routes/darshan.routes.js";
import cruiseRoutes from "./routes/cruise.routes.js";
import staysRoutes from "./routes/Stays.routes.js";

const allowedOrigins = new Set([
  "https://birdmytrip.com",
  "https://www.birdmytrip.com",
  "https://ops.birdmytrip.com",
  "http://localhost:3000",
  "http://localhost:5173",
]);

async function startServer() {
  // 1. Connect database
  await connectDatabase();

  // 2. Initialize Express
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // 3. Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: {
        policy: "cross-origin",
      },
    })
  );

  // 4. CORS
  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests without Origin (health checks/server-to-server).
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }

        logger.warn({ origin }, "CORS origin rejected");
        return callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
      methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
      ],
      optionsSuccessStatus: 204,
      maxAge: 86400,
    })
  );

  // 5. Request logging
  app.use(
    pinoHttp({
      logger,
      genReqId: () => crypto.randomUUID(),
      autoLogging: !env.isProduction,
    })
  );

  // 6. Rate limiting
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: env.isProduction ? 100 : 10000,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        },
      },
    })
  );

  // 7. Parse request bodies
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // 8. Root endpoint
  app.get("/", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "BMT Admin Backend is running",
      environment: env.nodeEnv,
    });
  });

  // 9. Health endpoint
  app.get("/health/live", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  // 10. Authentication
  app.use("/auth", authRoutes);

  // 11. Admin routes
  app.use("/admin/dashboard", executiveCommandRoutes);
  app.use("/admin/my-work", myWorkRoutes);
  app.use("/admin/approvals", approvalRoutes);
  app.use("/admin/operations-inbox", operationsInboxRoutes);
  app.use("/admin/live-incidents", liveIncidentRoutes);
  app.use("/admin/service-health", serviceHealthRoutes);
  app.use("/admin/change-calendar", changeCalendarRoutes);
  app.use("/admin/shift-handovers", shiftHandoverRoutes);
  app.use("/admin/postmortems", postmortemRoutes);
  app.use("/admin/situation-reports", situationReportRoutes);

  // 12. Bus, cab and travel routes
  app.use("/admin/bus", busRoutes);
  app.use("/admin/cab", cabRoutes);
  app.use("/admin/packages", packagesRoutes);
  app.use("/admin/activities", activitiesRoutes);
  app.use("/admin/events", eventsRoutes);
  app.use("/admin/darshan", darshanRoutes);
  app.use("/admin/cruises", cruiseRoutes);
  app.use("/admin/stays", staysRoutes);

  // 13. Not found
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        path: req.originalUrl,
      },
    });
  });

  // 14. Central error handler
  app.use(errorHandler);

  // 15. Start server (Render supplies PORT)
  const port = Number(process.env.PORT || env.port || 10000);
  const host = "0.0.0.0";

  const server = app.listen(port, host, () => {
    logger.info(
      { host, port, environment: env.nodeEnv },
      "BMT Admin Backend started"
    );
    logger.info("Health endpoint: /health/live");
  });

  // 16. Graceful shutdown
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, "Graceful shutdown started");

    const forceExit = setTimeout(() => {
      logger.error("Shutdown timed out");
      process.exit(1);
    }, 10000);

    forceExit.unref();

    server.close(async (error) => {
      try {
        await disconnectDatabase();

        if (error) {
          logger.error({ err: error }, "HTTP server shutdown failed");
          process.exitCode = 1;
        } else {
          logger.info("Server closed successfully");
        }
      } catch (dbError) {
        logger.error({ err: dbError }, "Database disconnect failed");
        process.exitCode = 1;
      } finally {
        clearTimeout(forceExit);
      }
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  logger.error({ err: error }, "Failed to start server");
  process.exit(1);
});
