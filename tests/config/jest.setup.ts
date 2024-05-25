import { DataSource } from "typeorm";
import { Fastypest } from "../../dist/core";
import { initialize } from "./orm.config";

jest.setTimeout(100_000);

let fastypest: Fastypest;
let connection: DataSource;

beforeAll(async () => {
  connection = await initialize();
  fastypest = new Fastypest(connection);
  await fastypest.init();
});

afterEach(async () => {
  await fastypest.restoreData();
});

afterAll(async () => {
  await connection.destroy();
});
