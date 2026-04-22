ALTER TABLE "wear_events" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "wear_events" ADD COLUMN "visibility" "wear_visibility" DEFAULT 'public' NOT NULL;
