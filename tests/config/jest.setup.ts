import path from "node:path";
import { DataSource } from "typeorm";
import { Fastypest } from "../../src/core";
import { createScopedLogger, LoggingDetailLevel } from "../../src/logging";
import { initialize } from "./orm.config";

jest.setTimeout(100_000);

let fastypest: Fastypest;
let connection: DataSource;

const LOCAL_FASTYPEST_SPECS = new Set([
  "change-detection.spec.ts",
  "none-strategy.spec.ts",
  "fk-cases.spec.ts",
]);
const logger = createScopedLogger("JestSetup", {
  enabled: true,
  detail: LoggingDetailLevel.Simple,
});

const shouldSkipDefaultFastypestSetup = (): boolean => {
  const testPath = expect.getState().testPath;
  if (!testPath) return false;
  return LOCAL_FASTYPEST_SPECS.has(path.basename(testPath));
};

beforeAll(async () => {
  connection = await initialize();
  if (shouldSkipDefaultFastypestSetup()) {
    logger.warn("⏭️ Skipping default Fastypest setup");
    return;
  }
  fastypest = new Fastypest(connection, {
    logging: { enabled: true, detail: LoggingDetailLevel.Simple },
  });
  await fastypest.init();
});

afterEach(async () => {
  if (shouldSkipDefaultFastypestSetup()) {
    logger.warn("⏭️ Skipping default Fastypest restore");
    return;
  }
  if (!fastypest) {
    return;
  }
  await fastypest.restoreData();
});

afterAll(async () => {
  if (connection?.isInitialized) {
    await connection.destroy();
  }
});
