CREATE TYPE "public"."item_event_kind" AS ENUM('created', 'completed', 'reopened', 'moved', 'edited');--> statement-breakpoint
CREATE TABLE "item_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"kind" "item_event_kind" NOT NULL,
	"detail" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "hide_completed_after_minutes" smallint;--> statement-breakpoint
ALTER TABLE "item_events" ADD CONSTRAINT "item_events_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;