-- Phase 7: Create social tables (from Drizzle schema)
-- Must run before RLS migration (20260420000001)

CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "display_name" text,
  "bio" text,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "profiles_username_unique" UNIQUE("username")
);

CREATE TABLE "follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "follower_id" uuid NOT NULL,
  "following_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "follows_unique_pair" UNIQUE("follower_id","following_id")
);

CREATE TABLE "profile_settings" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "profile_public" boolean DEFAULT true NOT NULL,
  "collection_public" boolean DEFAULT true NOT NULL,
  "wishlist_public" boolean DEFAULT true NOT NULL,
  "worn_public" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "watch_id" uuid,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "wear_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "watch_id" uuid NOT NULL,
  "worn_date" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wear_events_unique_day" UNIQUE("user_id","watch_id","worn_date")
);

-- Foreign keys
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "profile_settings" ADD CONSTRAINT "profile_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "activities" ADD CONSTRAINT "activities_watch_id_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watches"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "wear_events" ADD CONSTRAINT "wear_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "wear_events" ADD CONSTRAINT "wear_events_watch_id_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watches"("id") ON DELETE cascade ON UPDATE no action;

-- Indexes
CREATE INDEX "profiles_username_idx" ON "profiles" USING btree ("username");
CREATE INDEX "follows_follower_idx" ON "follows" USING btree ("follower_id");
CREATE INDEX "follows_following_idx" ON "follows" USING btree ("following_id");
CREATE INDEX "activities_user_id_idx" ON "activities" USING btree ("user_id");
CREATE INDEX "activities_user_created_at_idx" ON "activities" USING btree ("user_id","created_at");
CREATE INDEX "wear_events_watch_worn_at_idx" ON "wear_events" USING btree ("watch_id","worn_date");
