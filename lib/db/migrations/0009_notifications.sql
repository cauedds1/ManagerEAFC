CREATE TABLE IF NOT EXISTS "notifications" (
"id" serial PRIMARY KEY NOT NULL,
"title" text NOT NULL,
"body" text NOT NULL,
"image_url" text,
"requires_response" boolean DEFAULT false NOT NULL,
"target_all" boolean DEFAULT true NOT NULL,
"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_targets" (
"notification_id" integer NOT NULL,
"user_id" integer NOT NULL,
CONSTRAINT "notification_targets_pkey" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_reads" (
"notification_id" integer NOT NULL,
"user_id" integer NOT NULL,
"responded_at" bigint,
CONSTRAINT "notification_reads_pkey" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_targets" ADD CONSTRAINT "notification_targets_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_targets" ADD CONSTRAINT "notification_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
