import { DataSource } from "typeorm";
import { Fastypest } from "../../src/index";
import { seed } from "../seeds/seed";
import { initialize } from "./orm.config";

jest.setTimeout(20_000);

let fastypest: Fastypest;
let connection: DataSource;

beforeAll(async () => {
  connection = await initialize();
  await seed(connection);
  fastypest = new Fastypest(connection);
  await fastypest.init();
});

afterEach(async () => {
  await fastypest.restoreData();
});

afterAll(async () => {
  await connection.destroy();
});
