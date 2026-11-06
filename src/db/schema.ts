import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { z } from "zod";
import type { Article, workspaceSchema } from "@/lib/content";

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

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const oauthAttempts = pgTable("oauth_attempts", {
  stateHash: text("state_hash").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  verifier: text("verifier").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const bufferConnections = pgTable(
  "buffer_connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    accountName: text("account_name").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    state: text("state").notNull().default("ready"),
    version: integer("version").notNull().default(0),
    refreshStartedAt: timestamp("refresh_started_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("buffer_workspace_unique").on(table.workspaceId),
    uniqueIndex("buffer_account_unique").on(table.accountId),
  ],
);

export const bufferAccounts = pgTable(
  "buffer_accounts",
  {
    accountId: text("account_id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("buffer_account_workspace_unique").on(table.workspaceId),
  ],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    requestKey: text("request_key").notNull(),
    articleId: text("article_id").notNull(),
    noteId: text("note_id").notNull(),
    channelId: text("channel_id").notNull(),
    text: text("text").notNull(),
    includeArticle: boolean("include_article").notNull().default(true),
    attachmentUrl: text("attachment_url"),
    mode: text("mode").notNull(),
    status: text("status").notNull().default("creating"),
    bufferPostId: text("buffer_post_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("delivery_request_unique").on(table.requestKey)],
);

export const publications = pgTable("publications", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  error: text("error"),
});

export const automation = pgTable("automation", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  channelId: text("channel_id"),
  notesPerPost: integer("notes_per_post").notNull().default(1),
  version: integer("version").notNull().default(0),
  policyVersion: integer("policy_version").notNull().default(0),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const importJobs = pgTable(
  "import_jobs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    state: text("state").notNull().default("queued"),
    autoVersion: integer("auto_version"),
    article: jsonb("article").$type<Article>(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("import_job_source_unique").on(
      table.workspaceId,
      table.sourceUrl,
    ),
  ],
);
