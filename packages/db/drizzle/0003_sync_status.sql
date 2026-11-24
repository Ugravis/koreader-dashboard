ALTER TABLE "devices" ADD COLUMN "sync_state" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "sync_step" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "covers_pending" integer;