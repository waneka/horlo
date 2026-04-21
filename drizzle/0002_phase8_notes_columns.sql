ALTER TABLE "watches" ADD COLUMN "notes_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "notes_updated_at" timestamp with time zone;