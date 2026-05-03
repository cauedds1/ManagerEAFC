ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text UNIQUE;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public_profiles" (
"career_id" text PRIMARY KEY NOT NULL,
"user_id" integer NOT NULL,
"is_public" boolean DEFAULT false NOT NULL,
"bio" text,
"favorite_club_id" integer,
"published_at" bigint,
"last_activity_at" bigint,
"auto_publish" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public_profiles" ADD CONSTRAINT "public_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public_posts" (
"id" text PRIMARY KEY NOT NULL,
"career_id" text NOT NULL,
"user_id" integer NOT NULL,
"original_news_post_id" text NOT NULL,
"content_json" text NOT NULL,
"lang" text DEFAULT 'pt' NOT NULL,
"published_at" bigint NOT NULL,
"is_hidden" boolean DEFAULT false NOT NULL,
"hidden_reason" text,
"is_special" text,
"reports_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public_posts" ADD CONSTRAINT "public_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_posts_published_at_idx" ON "public_posts" ("published_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_posts_career_id_idx" ON "public_posts" ("career_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_posts_user_id_idx" ON "public_posts" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_reactions" (
"post_id" text NOT NULL,
"user_id" integer NOT NULL,
"reaction_type" text NOT NULL,
"created_at" bigint NOT NULL,
CONSTRAINT "post_reactions_pkey" PRIMARY KEY("post_id","user_id","reaction_type")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_public_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."public_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_comments" (
"id" serial PRIMARY KEY NOT NULL,
"post_id" text NOT NULL,
"user_id" integer NOT NULL,
"parent_comment_id" integer,
"content" text NOT NULL,
"is_pinned" boolean DEFAULT false NOT NULL,
"is_hidden" boolean DEFAULT false NOT NULL,
"created_at" bigint NOT NULL,
"deleted_at" bigint,
"reports_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_public_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."public_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_comments_post_id_idx" ON "post_comments" ("post_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comment_reactions" (
"comment_id" integer NOT NULL,
"user_id" integer NOT NULL,
"created_at" bigint NOT NULL,
CONSTRAINT "comment_reactions_pkey" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_post_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_reposts" (
"post_id" text NOT NULL,
"user_id" integer NOT NULL,
"created_at" bigint NOT NULL,
CONSTRAINT "post_reposts_pkey" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_reposts" ADD CONSTRAINT "post_reposts_post_id_public_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."public_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_reposts" ADD CONSTRAINT "post_reposts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_blocks" (
"blocker_id" integer NOT NULL,
"blocked_id" integer NOT NULL,
"created_at" bigint NOT NULL,
CONSTRAINT "user_blocks_pkey" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_reports" (
"id" serial PRIMARY KEY NOT NULL,
"target_type" text NOT NULL,
"target_id" text NOT NULL,
"reporter_id" integer NOT NULL,
"reason" text NOT NULL,
"notes" text,
"status" text DEFAULT 'pending' NOT NULL,
"created_at" bigint NOT NULL,
"reviewed_at" bigint
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_reports_status_idx" ON "content_reports" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_daily_quota" (
"user_id" integer NOT NULL,
"date_utc" text NOT NULL,
"posts_published" integer DEFAULT 0 NOT NULL,
CONSTRAINT "user_daily_quota_pkey" PRIMARY KEY("user_id","date_utc")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_daily_quota" ADD CONSTRAINT "user_daily_quota_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_last_seen" (
"user_id" integer PRIMARY KEY NOT NULL,
"last_seen_at" bigint NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_last_seen" ADD CONSTRAINT "community_last_seen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" (LOWER("username"));
