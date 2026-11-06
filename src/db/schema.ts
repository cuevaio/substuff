import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { z } from "zod";
import type { workspaceSchema } from "@/lib/content";

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  document: jsonb("document")
    .$type<z.infer<typeof workspaceSchema>>()
    .notNull(),
  revision: integer("revision").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const generationLimits = pgTable("generation_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
