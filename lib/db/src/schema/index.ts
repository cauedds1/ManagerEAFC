import { pgTable, integer, text, bigint, primaryKey } from "drizzle-orm/pg-core";

export const clubsTable = pgTable("clubs", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url").notNull().default(""),
  league: text("league").notNull(),
  leagueId: integer("league_id").notNull(),
  country: text("country"),
  cachedAt: bigint("cached_at", { mode: "number" }).notNull(),
});

export const squadPlayersTable = pgTable(
  "squad_players",
  {
    teamId: integer("team_id").notNull(),
    playerId: integer("player_id").notNull(),
    name: text("name").notNull(),
    age: integer("age").notNull().default(0),
    position: text("position").notNull(),
    positionPtBr: text("position_pt_br").notNull(),
    photo: text("photo").notNull().default(""),
    playerNumber: integer("player_number"),
    source: text("source").notNull(),
    cachedAt: bigint("cached_at", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.playerId] })],
);
