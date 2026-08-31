--> Hand written. Drizzle generated a bare SET DATA TYPE, which Postgres
--> rejects because an enum has no implicit cast to smallint, and which would
--> have discarded the existing levels even if it worked.
ALTER TABLE "items" ALTER COLUMN "priority" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "priority" SET DATA TYPE smallint
  USING (
    CASE "priority"::text
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
      ELSE 3
    END
  );--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "priority" SET DEFAULT 3;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "priority_is_one_to_five" CHECK ("priority" BETWEEN 1 AND 5);--> statement-breakpoint
DROP TYPE "public"."item_priority";
