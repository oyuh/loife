CREATE TABLE "study_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer,
	"subject" text,
	"planned_minutes" smallint,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"actual_minutes" smallint
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "study_minutes" smallint;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;