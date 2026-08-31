CREATE TYPE "public"."item_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('todo', 'doing', 'done');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('assignment', 'exam', 'task', 'reading');--> statement-breakpoint
CREATE TYPE "public"."log_kind" AS ENUM('journal', 'event');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer,
	"log_entry_id" integer,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_key_unique" UNIQUE("key"),
	CONSTRAINT "attachment_has_exactly_one_owner" CHECK (("attachments"."item_id" IS NULL) <> ("attachments"."log_entry_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"color" text,
	"term" text,
	"term_start" date,
	"term_end" date,
	"days" smallint[],
	"start_time" time,
	"end_time" time,
	"location" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"google_event_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer,
	"name" text NOT NULL,
	"type" "item_type" DEFAULT 'assignment' NOT NULL,
	"due_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"priority" "item_priority" DEFAULT 'normal' NOT NULL,
	"status" "item_status" DEFAULT 'todo' NOT NULL,
	"location" text,
	"notes" text,
	"google_event_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "log_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"kind" "log_kind" DEFAULT 'journal' NOT NULL,
	"title" text,
	"body" text,
	"course_id" integer,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_log_entry_id_log_entries_id_fk" FOREIGN KEY ("log_entry_id") REFERENCES "public"."log_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_journal_per_day" ON "log_entries" USING btree ("date") WHERE "log_entries"."kind" = 'journal';