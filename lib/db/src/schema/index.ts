import { pgTable, integer, text, bigint, jsonb } from "drizzle-orm/pg-core";

export const clubsTable = pgTable("clubs", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url").notNull().default(""),
  league: text("league").notNull(),
  leagueId: integer("league_id").notNull(),
  country: text("country"),
  cachedAt: bigint("cached_at", { mode: "number" }).notNull(),
});

export const squadsTable = pgTable("squads", {
  teamId: integer("team_id").primaryKey(),
  players: jsonb("players").notNull(),
  source: text("source").notNull(),
  cachedAt: bigint("cached_at", { mode: "number" }).notNull(),
});
