import { createScopedLogger, LogLevel } from "../../src/logging";
import { seed } from "../seeds/seed";
import { prepareDatabase } from "./orm.config";

const testLogLevels = Object.values(LogLevel) as LogLevel[];

const logger = createScopedLogger("GlobalSetup", {
  enabled: true,
  levels: testLogLevels,
});

const init = async () => {
  logger.verbose("⚙️ Preparing database for test suite");
  const connection = await prepareDatabase();
  const timer = logger.timer("Database seeding");
  logger.debug("🌱 Seeding database with fixtures");
  await seed(connection);
  timer.end(
    "✅ Database seeded",
    LogLevel.Info,
    "Seeding completed for global setup"
  );
  await connection.destroy();
  logger.log("🧹 Database connection closed after seeding");
};

export default init;
