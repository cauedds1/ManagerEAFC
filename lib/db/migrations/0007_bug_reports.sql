CREATE TABLE IF NOT EXISTS "bug_reports" (
"id" serial PRIMARY KEY NOT NULL,
"user_id" integer,
"user_email" text,
"description" text NOT NULL,
"page" text DEFAULT '' NOT NULL,
"status" text DEFAULT 'open' NOT NULL,
"created_at" bigint NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
