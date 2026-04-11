CREATE TABLE "career_data" (
	"career_id" text NOT NULL,
	"key" text NOT NULL,
	"value_json" text NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "career_data_career_id_key_pk" PRIMARY KEY("career_id","key")
);
--> statement-breakpoint
CREATE TABLE "careers" (
	"id" text PRIMARY KEY NOT NULL,
	"coach_json" text NOT NULL,
	"club_id" integer DEFAULT 0 NOT NULL,
	"club_name" text NOT NULL,
	"club_logo" text DEFAULT '' NOT NULL,
	"club_league" text DEFAULT '' NOT NULL,
	"club_country" text,
	"club_stadium" text,
	"club_founded" integer,
	"club_primary" text,
	"club_secondary" text,
	"club_description" text,
	"club_titles_json" text,
	"season" text DEFAULT '' NOT NULL,
	"projeto" text,
	"competitions_json" text,
	"current_season_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text DEFAULT '' NOT NULL,
	"league" text NOT NULL,
	"league_id" integer NOT NULL,
	"country" text,
	"cached_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_data" (
	"season_id" text NOT NULL,
	"key" text NOT NULL,
	"value_json" text NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "season_data_season_id_key_pk" PRIMARY KEY("season_id","key")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" text PRIMARY KEY NOT NULL,
	"career_id" text NOT NULL,
	"label" text NOT NULL,
	"competitions_json" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "squad_players" (
	"team_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"name" text NOT NULL,
	"age" integer DEFAULT 0 NOT NULL,
	"position" text NOT NULL,
	"position_pt_br" text NOT NULL,
	"photo" text DEFAULT '' NOT NULL,
	"player_number" integer,
	"source" text NOT NULL,
	"cached_at" bigint NOT NULL,
	CONSTRAINT "squad_players_team_id_player_id_pk" PRIMARY KEY("team_id","player_id")
);
