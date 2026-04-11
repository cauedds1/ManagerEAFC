CREATE TABLE "custom_portals" (
	"id" text PRIMARY KEY NOT NULL,
	"career_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"tone" text NOT NULL,
	"photo_url" text,
	"created_at" bigint NOT NULL
);
