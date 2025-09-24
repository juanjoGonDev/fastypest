import { performance } from "node:perf_hooks";
import { createScopedLogger } from "../../src/logging";
import { seed } from "../seeds/seed";
import { prepareDatabase } from "./orm.config";

const LOG_SCOPE = "GlobalSetup";
const LOG_TEXT = {
  initializingDatabase: "⚙️ Initializing database",
  seedingDatabase: "🌱 Seeding database",
  databaseSeeded: "✅ Database seeded",
} as const;
const METADATA_KEYS = {
  durationSeconds: "durationInSeconds",
} as const;
const MILLISECONDS_IN_SECOND = 1000;
const DURATION_PRECISION = 2;

const logger = createScopedLogger(LOG_SCOPE, { enabled: true });

const init = async () => {
  logger.info(LOG_TEXT.initializingDatabase);
  const connection = await prepareDatabase();
  logger.info(LOG_TEXT.seedingDatabase);
  const startTime = performance.now();
  await seed(connection);
  const totalTime = (performance.now() - startTime) / MILLISECONDS_IN_SECOND;
  logger.info(LOG_TEXT.databaseSeeded, {
    [METADATA_KEYS.durationSeconds]: Number(
      totalTime.toFixed(DURATION_PRECISION)
    ),
  });
  await connection.destroy();
};

export default init;
