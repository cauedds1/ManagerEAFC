CREATE TABLE IF NOT EXISTS "bug_reports" (
"id" serial PRIMARY KEY NOT NULL,
"user_id" integer,
"user_email" text,
"description" text NOT NULL,
"page" text DEFAULT '' NOT NULL,
"status" text DEFAULT 'open' NOT NULL,
"created_at" bigint NOT NULL
);
