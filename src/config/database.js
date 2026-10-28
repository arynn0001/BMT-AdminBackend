// // src/config/database.js
// import dns from "node:dns";
// import mongoose from "mongoose";
// import { env } from "./env.js";
// import { logger } from "../utils/logger.js";

// let listenersAttached = false;

// function attachConnectionListeners() {
//   if (listenersAttached) return;
//   listenersAttached = true;
//   mongoose.connection.on("error", (err) => logger.error({ err }, "MongoDB connection error"));
//   mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
//   mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));
// }

// function cleanMongoUri(raw) {
//   let uri = String(raw || "").trim();
//   uri = uri.replace(/^MONGODB_URI\s*=\s*/i, "");
//   uri = uri.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "").trim();
//   const idx = uri.search(/mongodb(\+srv)?:\/\//i);
//   if (idx > 0) uri = uri.slice(idx);
//   return uri;
// }

// function describeUri(uri) {
//   const match = uri.match(/^(mongodb(?:\+srv)?):\/\/([^:/@]+):([^@]*)@([^/?]+)\/?([^?]*)/i);
//   if (!match) return { valid: false, startsWith: JSON.stringify(uri.slice(0, 14)) };
//   const [, scheme, username, password, hosts, dbName] = match;
//   return {
//     valid: true,
//     scheme: scheme.toLowerCase(),
//     username,
//     passwordLength: password.length,
//     hosts,
//     dbName: dbName || "(none)",
//   };
// }

// function checkDns(info) {
//   return new Promise((resolve) => {
//     if (info.scheme === "mongodb+srv") {
//       dns.resolveSrv(`_mongodb._tcp.${info.hosts}`, (err, records) => {
//         resolve(err ? { ok: false, error: err.code || err.message } : { ok: true, detail: `${records.length} shard host(s)` });
//       });
//     } else {
//       const host = info.hosts.split(",")[0].split(":")[0];
//       dns.lookup(host, { family: 4 }, (err, address) => {
//         resolve(err ? { ok: false, error: err.code || err.message } : { ok: true, detail: address });
//       });
//     }
//   });
// }

// const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// export async function connectDatabase(maxRetries = 5, retryDelayMs = 4000) {
//   attachConnectionListeners();

//   const uri = cleanMongoUri(env.mongodbUri);
//   const info = describeUri(uri);
//   logger.info({ mongo: info }, "MongoDB URI check");

//   if (!info.valid) {
//     logger.error(".env ki MONGODB_URI galat hai. Format: mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/dbname?retryWrites=true&w=majority");
//     process.exit(1);
//   }

//   for (let attempt = 1; attempt <= maxRetries; attempt++) {
//     const dnsResult = await checkDns(info);
//     if (!dnsResult.ok) {
//       logger.warn(`DNS fail (${dnsResult.error}) for ${info.hosts}. Retry ${attempt}/${maxRetries}...`);
//       if (["ENOTFOUND", "ENODATA"].includes(dnsResult.error)) {
//         logger.error("Ye hostname Atlas pe exist nahi karta. Atlas > Clusters > Connect > Drivers > Node.js se sahi string copy karo.");
//         process.exit(1);
//       }
//       if (attempt === maxRetries) {
//         logger.error("DNS lookup block/timeout ho raha hai. Hotspot/VPN try karo, ya Atlas se non-SRV (mongodb://ac-...) string lo.");
//         process.exit(1);
//       }
//       await sleep(retryDelayMs);
//       continue;
//     }

//     try {
//       logger.info(`Connecting to MongoDB... (attempt ${attempt}/${maxRetries}, ${dnsResult.detail})`);
//       await mongoose.connect(uri, {
//         serverSelectionTimeoutMS: 30000,
//         connectTimeoutMS: 30000,
//         socketTimeoutMS: 45000,
//         family: 4,
//       });
//       logger.info("✅ MongoDB connected successfully");
//       return mongoose.connection;
//     } catch (error) {
//       logger.error({ err: { name: error.name, message: error.message } }, "❌ MongoDB connection failed");
//       if (/bad auth|authentication failed/i.test(error.message)) {
//         logger.error("Username/password galat hai. Atlas > Database Access mein user check karo aur .env update karo.");
//         process.exit(1);
//       }
//       if (/Invalid scheme|MongoParseError/i.test(error.name + error.message)) {
//         logger.error("MONGODB_URI ka format galat hai.");
//         process.exit(1);
//       }
//       if (attempt === maxRetries) {
//         logger.error("Check karo: IP whitelist, internet/VPN, aur Atlas cluster paused to nahi.");
//         process.exit(1);
//       }
//       await sleep(retryDelayMs);
//     }
//   }
// }

// export async function disconnectDatabase() {
//   try {
//     await mongoose.connection.close();
//     logger.info("MongoDB connection closed");
//   } catch (error) {
//     logger.error({ err: error }, "Error closing MongoDB connection");
//   }
// }
// src/config/database.js
import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

// URI mein DB name na ho to ye use hoga (Render env mein MONGODB_DB_NAME se override kar sakte ho)
const DEFAULT_DB_NAME = process.env.MONGODB_DB_NAME || "bmt-admin-new";

let listenersAttached = false;

function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on("error", (err) => logger.error({ err }, "MongoDB connection error"));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));
}

function cleanMongoUri(raw) {
  let uri = String(raw || "").trim();
  uri = uri.replace(/^MONGODB_URI\s*=\s*/i, "");
  uri = uri.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "").trim();
  const idx = uri.search(/mongodb(\+srv)?:\/\//i);
  if (idx > 0) uri = uri.slice(idx);
  return uri;
}

function describeUri(uri) {
  const match = uri.match(/^(mongodb(?:\+srv)?):\/\/([^:/@]+):([^@]*)@([^/?]+)\/?([^?]*)/i);
  if (!match) return { valid: false, startsWith: JSON.stringify(uri.slice(0, 14)) };
  const [, scheme, username, password, hosts, dbName] = match;
  return {
    valid: true,
    scheme: scheme.toLowerCase(),
    username,
    passwordLength: password.length,
    hosts,
    dbName: dbName || "(none)",
  };
}

function checkDns(info) {
  return new Promise((resolve) => {
    if (info.scheme === "mongodb+srv") {
      dns.resolveSrv(`_mongodb._tcp.${info.hosts}`, (err, records) => {
        resolve(err ? { ok: false, error: err.code || err.message } : { ok: true, detail: `${records.length} shard host(s)` });
      });
    } else {
      const host = info.hosts.split(",")[0].split(":")[0];
      dns.lookup(host, { family: 4 }, (err, address) => {
        resolve(err ? { ok: false, error: err.code || err.message } : { ok: true, detail: address });
      });
    }
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connectDatabase(maxRetries = 5, retryDelayMs = 4000) {
  attachConnectionListeners();

  const uri = cleanMongoUri(env.mongodbUri);
  const info = describeUri(uri);

  // Password log mein na aaye, isliye passwordLength hata diya
  logger.info(
    {
      mongo: {
        valid: info.valid,
        scheme: info.scheme,
        hosts: info.hosts,
        dbName: info.dbName,
      },
    },
    "MongoDB URI check"
  );

  if (!info.valid) {
    logger.error(".env ki MONGODB_URI galat hai. Format: mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/dbname?retryWrites=true&w=majority");
    process.exit(1);
  }

  // URI mein DB name ho to wahi use hoga, warna default
  const dbName = info.dbName === "(none)" ? DEFAULT_DB_NAME : undefined;
  logger.info(`Using database: ${dbName || info.dbName}`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const dnsResult = await checkDns(info);
    if (!dnsResult.ok) {
      logger.warn(`DNS fail (${dnsResult.error}) for ${info.hosts}. Retry ${attempt}/${maxRetries}...`);
      if (["ENOTFOUND", "ENODATA"].includes(dnsResult.error)) {
        logger.error("Ye hostname Atlas pe exist nahi karta. Atlas > Clusters > Connect > Drivers > Node.js se sahi string copy karo.");
        process.exit(1);
      }
      if (attempt === maxRetries) {
        logger.error("DNS lookup block/timeout ho raha hai. Hotspot/VPN try karo, ya Atlas se non-SRV (mongodb://ac-...) string lo.");
        process.exit(1);
      }
      await sleep(retryDelayMs);
      continue;
    }

    try {
      logger.info(`Connecting to MongoDB... (attempt ${attempt}/${maxRetries}, ${dnsResult.detail})`);
      await mongoose.connect(uri, {
        ...(dbName ? { dbName } : {}),
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        family: 4,
      });
      logger.info("✅ MongoDB connected successfully");
      return mongoose.connection;
    } catch (error) {
      logger.error({ err: { name: error.name, message: error.message } }, "❌ MongoDB connection failed");
      if (/bad auth|authentication failed/i.test(error.message)) {
        logger.error("Username/password galat hai. Atlas > Database Access mein user check karo aur .env update karo.");
        process.exit(1);
      }
      if (/Invalid scheme|MongoParseError/i.test(error.name + error.message)) {
        logger.error("MONGODB_URI ka format galat hai.");
        process.exit(1);
      }
      if (attempt === maxRetries) {
        logger.error("Check karo: IP whitelist, internet/VPN, aur Atlas cluster paused to nahi.");
        process.exit(1);
      }
      await sleep(retryDelayMs);
    }
  }
}

export async function disconnectDatabase() {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed");
  } catch (error) {
    logger.error({ err: error }, "Error closing MongoDB connection");
  }
}
