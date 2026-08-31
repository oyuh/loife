ALTER TABLE "courses" ADD COLUMN "meeting_interval" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "meeting_dates" date[];