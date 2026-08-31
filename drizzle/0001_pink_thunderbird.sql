CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"google_refresh_token" text,
	"google_calendar_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_is_a_single_row" CHECK ("settings"."id" = 1)
);
