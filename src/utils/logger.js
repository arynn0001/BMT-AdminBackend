/**
 * Logger Setup
 * 
 * Pino logger use kar rahe hain. Ye fast hai aur production-ready.
 * Development mein pretty print, production mein JSON format.
 */

import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.logLevel,

  // Development mein readable format
  ...(env.isDevelopment && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),

  // Sensitive data redact karo
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "passwordHash",
      "token",
      "accessToken",
      "otp",
      "code",
    ],
    censor: "[REDACTED]",
  },
});