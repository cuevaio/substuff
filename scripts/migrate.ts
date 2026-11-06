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
await neon(
  url,
)`GRANT SELECT, INSERT, UPDATE, DELETE ON workspaces, generation_limits, sessions, oauth_attempts, buffer_connections, buffer_accounts, deliveries TO substuff_app`;
console.log("Drizzle migrations applied.");
