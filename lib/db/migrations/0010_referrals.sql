ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text UNIQUE;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
"id" serial PRIMARY KEY NOT NULL,
"referrer_id" integer NOT NULL,
"referred_id" integer NOT NULL,
"referred_plan" text NOT NULL,
"status" text DEFAULT 'pending' NOT NULL,
"notes" text,
"created_at" bigint NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_users_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
