ALTER TABLE "deliveries" ADD COLUMN "include_article" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "attachment_url" text;