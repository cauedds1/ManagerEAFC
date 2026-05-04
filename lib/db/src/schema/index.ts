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
  backstory: text("backstory"),
  initialContextJson: text("initial_context_json"),
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
  lemonSqueezyCustomerId: text("lemon_squeezy_customer_id"),
  lang: text("lang").default("pt"),
  lastLoginAt: bigint("last_login_at", { mode: "number" }),
  referralCode: text("referral_code").unique(),
  pushToken: text("push_token"),
  username: text("username").unique(),
});

export const publicProfilesTable = pgTable("public_profiles", {
  careerId: text("career_id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  isPublic: boolean("is_public").notNull().default(false),
  bio: text("bio"),
  favoriteClubId: integer("favorite_club_id"),
  publishedAt: bigint("published_at", { mode: "number" }),
  lastActivityAt: bigint("last_activity_at", { mode: "number" }),
  autoPublish: boolean("auto_publish").notNull().default(false),
});

export const publicPostsTable = pgTable("public_posts", {
  id: text("id").primaryKey(),
  careerId: text("career_id").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  originalNewsPostId: text("original_news_post_id").notNull(),
  contentJson: text("content_json").notNull(),
  lang: text("lang").notNull().default("pt"),
  publishedAt: bigint("published_at", { mode: "number" }).notNull(),
  isHidden: boolean("is_hidden").notNull().default(false),
  hiddenReason: text("hidden_reason"),
  isSpecial: text("is_special"),
  reportsCount: integer("reports_count").notNull().default(0),
});

export const postReactionsTable = pgTable(
  "post_reactions",
  {
    postId: text("post_id").notNull().references(() => publicPostsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    reactionType: text("reaction_type").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId, table.reactionType] })],
);

export const postCommentsTable = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: text("post_id").notNull().references(() => publicPostsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  parentCommentId: integer("parent_comment_id"),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  deletedAt: bigint("deleted_at", { mode: "number" }),
  reportsCount: integer("reports_count").notNull().default(0),
});

export const commentReactionsTable = pgTable(
  "comment_reactions",
  {
    commentId: integer("comment_id").notNull().references(() => postCommentsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.commentId, table.userId] })],
);

export const postRepostsTable = pgTable(
  "post_reposts",
  {
    postId: text("post_id").notNull().references(() => publicPostsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })],
);

export const userBlocksTable = pgTable(
  "user_blocks",
  {
    blockerId: integer("blocker_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    blockedId: integer("blocked_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.blockerId, table.blockedId] })],
);

export const contentReportsTable = pgTable("content_reports", {
  id: serial("id").primaryKey(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reporterId: integer("reporter_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  reviewedAt: bigint("reviewed_at", { mode: "number" }),
});

export const userDailyQuotaTable = pgTable(
  "user_daily_quota",
  {
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    dateUtc: text("date_utc").notNull(),
    postsPublished: integer("posts_published").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.dateUtc] })],
);

export const communityLastSeenTable = pgTable("community_last_seen", {
  userId: integer("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  lastSeenAt: bigint("last_seen_at", { mode: "number" }).notNull(),
});

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  referredId: integer("referred_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  referredPlan: text("referred_plan").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
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
