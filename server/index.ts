import { createDatabase } from "./db.js";
import { createApp } from "./app.js";
const db = await createDatabase();
const app = await createApp(db);
await app.listen({
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",
});
console.log(`FairShare: http://localhost:${process.env.PORT || 3000}`);
async function shutdown() {
  await app.close();
  await db.close();
  process.exit(0);
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
