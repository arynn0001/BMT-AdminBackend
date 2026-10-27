import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

import mongoose from "mongoose";
import "dotenv/config";

const uri = process.env.MONGODB_URI;
console.log("URI:", uri ? uri.substring(0, 70) + "..." : "MISSING");

await mongoose.connect(uri, { family: 4 });
console.log("✅ DB name:", mongoose.connection.name);
console.log("Host:", mongoose.connection.host);

const cols = await mongoose.connection.db.listCollections().toArray();
console.log("\nCollections:");
for (const c of cols) {
  const n = await mongoose.connection.db.collection(c.name).countDocuments();
  console.log(`  ${c.name}: ${n}`);
}

const busCol = mongoose.connection.db.collection("buses");
const cnt = await busCol.countDocuments();
console.log("\n🚌 buses collection:", cnt, "documents");

if (cnt > 0) {
  const s = await busCol.findOne();
  console.log("\n📄 Fields:", Object.keys(s).join(", "));
  console.log("\nSample:", JSON.stringify(s, null, 2).substring(0, 800));
}

process.exit(0);