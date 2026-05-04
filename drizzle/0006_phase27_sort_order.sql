ALTER TABLE "watches" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "watches_user_sort_idx" ON "watches" USING btree ("user_id","sort_order");
