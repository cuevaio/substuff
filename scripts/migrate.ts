import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url =
  process.env.DATABASE_ADMIN_URL ||
  readFileSync(
    `${process.env.HOME}/.config/substuff/database-admin-url`,
    "utf8",
  ).trim();
await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
console.log("Drizzle migrations applied.");
