import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function runMigrations(migrationsFolder: string): Promise<void> {
  console.log(`[migrations] Starting — folder: ${migrationsFolder}`);

  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error(`[migrations] Journal not found at ${journalPath}`);
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  console.log(`[migrations] Found ${journal.entries.length} migration(s) in journal`);

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id        SERIAL PRIMARY KEY,
        hash      TEXT   NOT NULL UNIQUE,
        created_at BIGINT
      )
    `);

    const { rows: applied } = await client.query<{ hash: string }>(
      "SELECT hash FROM __drizzle_migrations ORDER BY id"
    );
    const appliedSet = new Set(applied.map((r) => r.hash));
    console.log(`[migrations] Already applied: ${applied.map((r) => r.hash).join(", ") || "none"}`);

    for (const entry of journal.entries) {
      if (appliedSet.has(entry.tag)) {
        console.log(`[migrations] Skip ${entry.tag} (already applied)`);
        continue;
      }

      const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
      if (!fs.existsSync(sqlPath)) {
        throw new Error(`[migrations] SQL file not found: ${sqlPath}`);
      }

      const sql = fs.readFileSync(sqlPath, "utf-8");
      const statements = sql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);

      console.log(`[migrations] Applying ${entry.tag} (${statements.length} statements)...`);
      for (const stmt of statements) {
        const safeStmt = stmt.replace(/^CREATE TABLE\s+(?!IF NOT EXISTS)/im, "CREATE TABLE IF NOT EXISTS ");
        await client.query(safeStmt);
      }

      await client.query(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)",
        [entry.tag, Date.now()]
      );
      console.log(`[migrations] Applied ${entry.tag} ✓`);
    }

    console.log("[migrations] All migrations complete ✓");
  } finally {
    client.release();
  }
}

export * from "./schema";
