ALTER TABLE "watches_catalog" ADD COLUMN "formality" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN "sportiness" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN "heritage_score" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN "primary_archetype" text;--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN "era_signal" text;--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN "design_motifs" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN "confidence" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN "extracted_from_photo" boolean DEFAULT false NOT NULL;