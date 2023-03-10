import { DataSource } from "typeorm";
import { initialize } from ".";
import { Fastypest } from "../../dist";
import { seed } from "../seeds";

jest.setTimeout(100_000);

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
