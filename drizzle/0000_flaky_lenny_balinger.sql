CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"preferred_styles" text[] DEFAULT '{}'::text[] NOT NULL,
	"disliked_styles" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_design_traits" text[] DEFAULT '{}'::text[] NOT NULL,
	"disliked_design_traits" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_complications" text[] DEFAULT '{}'::text[] NOT NULL,
	"complication_exceptions" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_dial_colors" text[] DEFAULT '{}'::text[] NOT NULL,
	"disliked_dial_colors" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_case_size_range" jsonb,
	"overlap_tolerance" text DEFAULT 'medium' NOT NULL,
	"collection_goal" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"reference" text,
	"status" text NOT NULL,
	"price_paid" real,
	"target_price" real,
	"market_price" real,
	"movement" text NOT NULL,
	"complications" text[] DEFAULT '{}'::text[] NOT NULL,
	"case_size_mm" real,
	"lug_to_lug_mm" real,
	"water_resistance_m" integer,
	"strap_type" text,
	"crystal_type" text,
	"dial_color" text,
	"style_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"design_traits" text[] DEFAULT '{}'::text[] NOT NULL,
	"role_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"acquisition_date" text,
	"last_worn_date" text,
	"production_year" integer,
	"is_flagged_deal" boolean DEFAULT false,
	"is_chronometer" boolean DEFAULT false,
	"notes" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watches_user_id_idx" ON "watches" USING btree ("user_id");