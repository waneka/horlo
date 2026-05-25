-- Phase 60 — watch_photos table + drop watches.image_url column
-- LOCAL SYNC ONLY — drizzle-kit column shapes.
-- The authoritative migration (backfill + lossless assert + DROP + RLS + bucket)
-- lives in supabase/migrations/20260525000000_phase60_watch_photos.sql.
-- Per project_drizzle_supabase_db_mismatch: apply the Supabase migration FIRST
-- locally (for the backfill), then run drizzle-kit push to sync column shapes.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watch_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_photos_watch_id_sort_idx" ON "watch_photos" USING btree ("watch_id","sort_order");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_photos" ADD CONSTRAINT "watch_photos_watch_id_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "watches" DROP COLUMN IF EXISTS "image_url";
