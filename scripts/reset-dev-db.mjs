// Resets the local development database. The JSON store reseeds itself from
// src/lib/data/seed.ts on the next request, so deleting the files is enough.
// Usage: npm run db:reset
import { rmSync, existsSync } from "node:fs";
import path from "node:path";

const files = ["db.json", "db.e2e.json"];
for (const file of files) {
  const full = path.join(process.cwd(), "data", file);
  if (existsSync(full)) {
    rmSync(full);
    console.log(`removed data/${file}`);
  }
}
console.log("Dev database reset — it reseeds on the next request.");
console.log("If `npm run dev` is running, restart it to drop in-memory state.");
