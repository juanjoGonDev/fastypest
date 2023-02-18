import { DataSource } from "typeorm";
import { TypeormTestBoost } from "../../src/index";
import { seed } from "../seeds/seed";
import { initialize } from "./orm.config";

jest.setTimeout(10_000);

let boost: TypeormTestBoost;
let connection: DataSource;

beforeAll(async () => {
  connection = await initialize();
  await seed(connection);
  boost = new TypeormTestBoost(connection);
  await boost.init();
});

afterEach(async () => {
  await boost.restoreData();
});

afterAll(async () => {
  await connection.destroy();
});
