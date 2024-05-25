import { seed } from "../seeds/seed";
import { prepareDatabase } from "./orm.config";

const init = async () => {
  console.log("Initializing database...");
  const connection = await prepareDatabase();
  console.log("Seeding database...");
  await seed(connection);
  await connection.destroy();
  console.log("Database initialized");
};

export default init;
