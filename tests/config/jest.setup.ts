import path from "node:path";
import { DataSource } from "typeorm";
import { Fastypest } from "../../dist/core";
import { createScopedLogger, LogLevel } from "../../src/logging";
import { initialize } from "./orm.config";

jest.setTimeout(100_000);

let fastypest: Fastypest;
let connection: DataSource;

const CHANGE_DETECTION_SPEC_BASENAME = "change-detection.spec.ts";
const testLogLevels = Object.values(LogLevel) as LogLevel[];
const logger = createScopedLogger("JestSetup", {
  enabled: true,
  levels: testLogLevels,
});

const shouldSkipDefaultFastypestSetup = (): boolean => {
  const testPath = expect.getState().testPath;
  if (!testPath) return false;
  return path.basename(testPath) === CHANGE_DETECTION_SPEC_BASENAME;
};

beforeAll(async () => {
  connection = await initialize();
  if (shouldSkipDefaultFastypestSetup()) {
    logger.warn("⏭️ Skipping default Fastypest setup");
    return;
  }
  fastypest = new Fastypest(connection, {
    logging: { enabled: true, levels: testLogLevels },
  });
  await fastypest.init();
});

afterEach(async () => {
  if (shouldSkipDefaultFastypestSetup()) {
    logger.warn("⏭️ Skipping default Fastypest restore");
    return;
  }
  await fastypest.restoreData();
});

afterAll(async () => {
  await connection.destroy();
});
