CREATE TABLE "buffer_accounts" (
	"account_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buffer_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"account_id" text NOT NULL,
	"account_name" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'ready' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"refresh_started_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"request_key" text NOT NULL,
	"article_id" text NOT NULL,
	"note_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"text" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'creating' NOT NULL,
	"buffer_post_id" text,
	"due_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_attempts" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"verifier" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buffer_accounts" ADD CONSTRAINT "buffer_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buffer_connections" ADD CONSTRAINT "buffer_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_attempts" ADD CONSTRAINT "oauth_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "buffer_account_workspace_unique" ON "buffer_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "buffer_workspace_unique" ON "buffer_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "buffer_account_unique" ON "buffer_connections" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_request_unique" ON "deliveries" USING btree ("request_key");