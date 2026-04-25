import { pgTable, integer, text, bigint, boolean, primaryKey, serial } from "drizzle-orm/pg-core";

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

export const careersTable = pgTable("careers", {
  id: text("id").primaryKey(),
  coachJson: text("coach_json").notNull(),
  clubId: integer("club_id").notNull().default(0),
  clubName: text("club_name").notNull(),
  clubLogo: text("club_logo").notNull().default(""),
  clubLeague: text("club_league").notNull().default(""),
  clubCountry: text("club_country"),
  clubStadium: text("club_stadium"),
  clubFounded: integer("club_founded"),
  clubPrimary: text("club_primary"),
  clubSecondary: text("club_secondary"),
  clubDescription: text("club_description"),
  clubTitlesJson: text("club_titles_json"),
  season: text("season").notNull().default(""),
  projeto: text("projeto"),
  competitionsJson: text("competitions_json"),
  currentSeasonId: text("current_season_id"),
  userId: integer("user_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const seasonsTable = pgTable("seasons", {
  id: text("id").primaryKey(),
  careerId: text("career_id").notNull(),
  label: text("label").notNull(),
  competitionsJson: text("competitions_json"),
  isActive: boolean("is_active").notNull().default(false),
  finalized: boolean("finalized").default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const seasonDataTable = pgTable(
  "season_data",
  {
    seasonId: text("season_id").notNull(),
    key: text("key").notNull(),
    valueJson: text("value_json").notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.seasonId, table.key] })],
);

export const careerDataTable = pgTable(
  "career_data",
  {
    careerId: text("career_id").notNull(),
    key: text("key").notNull(),
    valueJson: text("value_json").notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.careerId, table.key] })],
);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  plan: text("plan").notNull().default("free"),
  aiUsageCount: integer("ai_usage_count").notNull().default(0),
  aiUsageResetDate: text("ai_usage_reset_date").notNull().default(""),
  stripeCustomerId: text("stripe_customer_id"),
  lastLoginAt: bigint("last_login_at", { mode: "number" }),
});

export const customPortalsTable = pgTable("custom_portals", {
  id: text("id").primaryKey(),
  careerId: text("career_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  tone: text("tone").notNull(),
  photoUrl: text("photo_url"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const clubInfoCacheTable = pgTable("club_info_cache", {
  id: serial("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(),
  description: text("description").notNull().default(""),
  titlesJson: text("titles_json").notNull().default("[]"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const bugReportsTable = pgTable("bug_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userEmail: text("user_email"),
  description: text("description").notNull(),
  page: text("page").notNull().default(""),
  status: text("status").notNull().default("open"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  requiresResponse: boolean("requires_response").notNull().default(false),
  targetAll: boolean("target_all").notNull().default(true),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const notificationTargetsTable = pgTable(
  "notification_targets",
  {
    notificationId: integer("notification_id").notNull().references(() => notificationsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.notificationId, table.userId] })],
);

export const notificationReadsTable = pgTable(
  "notification_reads",
  {
    notificationId: integer("notification_id").notNull().references(() => notificationsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    respondedAt: bigint("responded_at", { mode: "number" }),
  },
  (table) => [primaryKey({ columns: [table.notificationId, table.userId] })],
);
