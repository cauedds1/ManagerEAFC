import app from "./app";
import { logger } from "./lib/logger";
import { db, squadPlayersTable } from "@workspace/db";
import { ne } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function purgeInvalidSquadRows() {
  try {
    const deleted = await db
      .delete(squadPlayersTable)
      .where(ne(squadPlayersTable.source, "api-football@v2"))
      .returning({ teamId: squadPlayersTable.teamId });
    logger.info({ rows: deleted.length }, "Purged legacy squad rows on startup");
  } catch (err) {
    logger.warn({ err }, "Failed to purge legacy squad rows on startup (non-fatal)");
  }
}

purgeInvalidSquadRows().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
