
import dotenv from "dotenv";
import { z } from "zod";

// .env file load karo
dotenv.config();

/**
 * Environment variables ka schema
 * Zod se validate karenge - agar koi field galat hai to error aayega
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("4000"),
  HOST: z.string().default("0.0.0.0"),

  // Database
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  // JWT
  JWT_SECRET: z.string().min(20, "JWT_SECRET must be at least 20 characters"),
  JWT_EXPIRES_IN: z.string().default("30d"),

  // CORS
  CORS_ORIGINS: z.string().default("http://localhost:5173",),

  // Email (SMTP)
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.string().default("587"),
  SMTP_USER: z.string().email("Invalid SMTP_USER email"),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
  SMTP_FROM: z.string().email("Invalid SMTP_FROM email"),

  // OTP
  OTP_EXPIRY_MINUTES: z.string().default("5"),
  BCRYPT_ROUNDS: z.string().default("10"),

  // Logging
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

// Validate karo
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Export karo - sab jagah use hoga
export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parseInt(parsed.data.PORT, 10),
  host: parsed.data.HOST,
  isProduction: parsed.data.NODE_ENV === "production",
  isDevelopment: parsed.data.NODE_ENV === "development",

  mongodbUri: parsed.data.MONGODB_URI,

  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,

  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()),

  smtp: {
    host: parsed.data.SMTP_HOST,
    port: parseInt(parsed.data.SMTP_PORT, 10),
    user: parsed.data.SMTP_USER,
    pass: parsed.data.SMTP_PASS,
    from: parsed.data.SMTP_FROM,
  },

  otpExpiryMinutes: parseInt(parsed.data.OTP_EXPIRY_MINUTES, 10),
  bcryptRounds: parseInt(parsed.data.BCRYPT_ROUNDS, 10),

  logLevel: parsed.data.LOG_LEVEL,
};