import { seed } from "../seeds/seed";
import { prepareDatabase } from "./orm.config";

const init = async () => {
  console.log("\nInitializing database...");
  const connection = await prepareDatabase();
  console.log("Seeding database...");
  const startTime = Date.now();
  await seed(connection);
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  console.log(`Database seeded in ${totalTime} seconds`);
  await connection.destroy();
};

export default init;
