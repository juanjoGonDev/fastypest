import path from "node:path";
import { DataSource } from "typeorm";
import { Fastypest } from "../../dist/core";
import { createScopedLogger } from "../../src/logging";
import { initialize } from "./orm.config";

jest.setTimeout(100_000);

let fastypest: Fastypest;
let connection: DataSource;

const CHANGE_DETECTION_SPEC_BASENAME = "change-detection.spec.ts";
const LOG_SCOPE = "JestSetup";
const LOG_MESSAGE_SKIP_SETUP = "Skipping default fastypest setup";
const LOG_MESSAGE_SKIP_RESTORE = "Skipping default fastypest restore";

const logger = createScopedLogger(LOG_SCOPE, { enabled: true });

const shouldSkipDefaultFastypestSetup = (): boolean => {
  const testPath = expect.getState().testPath;
  if (!testPath) return false;
  return path.basename(testPath) === CHANGE_DETECTION_SPEC_BASENAME;
};

beforeAll(async () => {
  connection = await initialize();
  if (shouldSkipDefaultFastypestSetup()) {
    logger.info(LOG_MESSAGE_SKIP_SETUP);
    return;
  }
  fastypest = new Fastypest(connection);
  await fastypest.init();
});

afterEach(async () => {
  if (shouldSkipDefaultFastypestSetup()) {
    logger.info(LOG_MESSAGE_SKIP_RESTORE);
    return;
  }
  await fastypest.restoreData();
});

afterAll(async () => {
  await connection.destroy();
});
