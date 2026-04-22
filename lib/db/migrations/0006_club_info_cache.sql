CREATE TABLE IF NOT EXISTS "club_info_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_key" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"titles_json" text DEFAULT '[]' NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "club_info_cache_cache_key_unique" UNIQUE("cache_key")
);
