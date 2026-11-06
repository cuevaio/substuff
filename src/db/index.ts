import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}
