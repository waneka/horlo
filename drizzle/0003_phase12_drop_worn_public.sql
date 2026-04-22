CREATE TYPE "public"."notification_type" AS ENUM('follow', 'watch_overlap', 'price_drop', 'trending_collector');--> statement-breakpoint
CREATE TYPE "public"."wear_visibility" AS ENUM('public', 'followers', 'private');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" "notification_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wear_events" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "wear_events" ADD COLUMN "visibility" "wear_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "profile_settings" DROP COLUMN "worn_public";