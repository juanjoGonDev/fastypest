import { DataSource } from "typeorm";
import {
  ChangeDetectionStrategy,
  Fastypest,
  LoggingDetailLevel,
} from "../../src/core";
import { getConnection } from "../config/orm.config";
import { seedCount } from "../config/seed.config";
import { DB_WITHOUT_QUOTES } from "../data/query";
import { Basic, Simple } from "../entities";

const TRACKED_BASIC_NAME = "tracked basic";
const RAW_SIMPLE_NAME = "raw simple";
const COMMENTED_UPDATE_NAME = "commented update basic";
const BASIC_TABLE_NAME = "basic";
const SIMPLE_TABLE_NAME = "simple";
const DEFAULT_SIMPLE_ID = 1;
const DROP_MISSING_TABLE_QUERY = "DROP TABLE IF EXISTS fastypest_missing_table";
const ORIGINAL_BASIC_NAME = "Basic 1";

describe("Change detection strategy", () => {
  const connection: DataSource = getConnection();
  const fastypest = new Fastypest(connection, {
    changeDetectionStrategy: ChangeDetectionStrategy.Query,
    logging: { enabled: true, detail: LoggingDetailLevel.Detailed },
  });
  const basicRepository = connection.getRepository(Basic);
  const simpleRepository = connection.getRepository(Simple);
  const dbType = connection.options.type;

  beforeAll(async () => {
    await fastypest.init();
  });

  it("restores changes detected by the query mediator", async () => {
    await basicRepository
      .createQueryBuilder(BASIC_TABLE_NAME)
      .insert()
      .values({ name: TRACKED_BASIC_NAME, simpleId: DEFAULT_SIMPLE_ID })
      .execute();

    const inserted = await basicRepository.findOneBy({ name: TRACKED_BASIC_NAME });
    expect(inserted).toBeDefined();

    await fastypest.restoreData();

    const restored = await basicRepository.findOneBy({ name: TRACKED_BASIC_NAME });
    expect(restored).toBeNull();
    const count = await basicRepository.count();
    expect(count).toBe(seedCount);
  });

  it("restores all tables when no tracked changes exist", async () => {
    await connection.query(insertSimpleQuery(RAW_SIMPLE_NAME));

    const inserted = await simpleRepository.findOneBy({ name: RAW_SIMPLE_NAME });
    expect(inserted).toBeDefined();

    await fastypest.restoreData();

    const restored = await simpleRepository.findOneBy({ name: RAW_SIMPLE_NAME });
    expect(restored).toBeNull();
  });

  it("falls back to full restore when an unsafe query is detected", async () => {
    await connection.query(insertSimpleQuery(RAW_SIMPLE_NAME));
    await connection.query(commentedUpdateBasicQuery());
    await connection.query(DROP_MISSING_TABLE_QUERY);

    const inserted = await simpleRepository.findOneBy({ name: RAW_SIMPLE_NAME });
    expect(inserted).toBeDefined();
    const updated = await basicRepository.findOneBy({ name: COMMENTED_UPDATE_NAME });
    expect(updated).toBeDefined();

    await fastypest.restoreData();

    const restoredSimple = await simpleRepository.findOneBy({ name: RAW_SIMPLE_NAME });
    expect(restoredSimple).toBeNull();
    const restoredBasic = await basicRepository.findOneBy({ name: ORIGINAL_BASIC_NAME });
    expect(restoredBasic).toBeDefined();
  });

  const insertSimpleQuery = (name: string) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `INSERT INTO ${quotes}${SIMPLE_TABLE_NAME}${quotes} (name) VALUES ('${name}')`;
  };

  const commentedUpdateBasicQuery = () => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `/* unsafe mutation */ UPDATE ${quotes}${BASIC_TABLE_NAME}${quotes} SET name = '${COMMENTED_UPDATE_NAME}' WHERE name = '${ORIGINAL_BASIC_NAME}'`;
  };
});
