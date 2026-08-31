ALTER TABLE "items" ADD COLUMN "estimated_minutes" smallint;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "actual_minutes" smallint;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "day_start" time DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "day_end" time DEFAULT '22:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "break_minutes" smallint DEFAULT 10 NOT NULL;