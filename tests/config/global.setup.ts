import { performance } from "node:perf_hooks";
import { createScopedLogger } from "../../src/logging";
import { seed } from "../seeds/seed";
import { prepareDatabase } from "./orm.config";

const LOG_SCOPE = "GlobalSetup";
const LOG_MESSAGE_INITIALIZING_DATABASE = "Initializing database";
const LOG_MESSAGE_SEEDING_DATABASE = "Seeding database";
const LOG_MESSAGE_DATABASE_SEEDED = "Database seeded";
const METADATA_KEY_DURATION_SECONDS = "durationInSeconds";
const MILLISECONDS_IN_SECOND = 1000;
const DURATION_PRECISION = 2;

const logger = createScopedLogger(LOG_SCOPE, { enabled: true });

const init = async () => {
  logger.info(LOG_MESSAGE_INITIALIZING_DATABASE);
  const connection = await prepareDatabase();
  logger.info(LOG_MESSAGE_SEEDING_DATABASE);
  const startTime = performance.now();
  await seed(connection);
  const totalTime = (performance.now() - startTime) / MILLISECONDS_IN_SECOND;
  logger.info(LOG_MESSAGE_DATABASE_SEEDED, {
    [METADATA_KEY_DURATION_SECONDS]: Number(totalTime.toFixed(DURATION_PRECISION)),
  });
  await connection.destroy();
};

export default init;
