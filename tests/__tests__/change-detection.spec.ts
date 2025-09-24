import { DataSource } from "typeorm";
import {
  ChangeDetectionStrategy,
  Fastypest,
} from "../../dist/core";
import { getConnection } from "../config/orm.config";
import { seedCount } from "../config/seed.config";
import { DB_WITHOUT_QUOTES } from "../data/query";
import { Basic, Simple } from "../entities";

const SUBSCRIBER_BASIC_NAME = "subscriber basic";
const RAW_SIMPLE_NAME = "raw simple";
const MANUAL_BASIC_NAME = "manual basic";
const BASIC_TABLE_NAME = "basic";
const SIMPLE_TABLE_NAME = "simple";
const DEFAULT_SIMPLE_ID = 1;

describe("Change detection strategy", () => {
  const connection: DataSource = getConnection();
  const fastypest = new Fastypest(connection, {
    changeDetectionStrategy: ChangeDetectionStrategy.Subscriber,
  });
  const basicRepository = connection.getRepository(Basic);
  const simpleRepository = connection.getRepository(Simple);
  const dbType = connection.options.type;

  beforeAll(async () => {
    await fastypest.init();
  });

  it("restores changes detected by the subscriber", async () => {
    await basicRepository
      .createQueryBuilder(BASIC_TABLE_NAME)
      .insert()
      .values({ name: SUBSCRIBER_BASIC_NAME, simpleId: DEFAULT_SIMPLE_ID })
      .execute();

    const inserted = await basicRepository.findOneBy({ name: SUBSCRIBER_BASIC_NAME });
    expect(inserted).toBeDefined();

    await fastypest.restoreData();

    const restored = await basicRepository.findOneBy({ name: SUBSCRIBER_BASIC_NAME });
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

  it("restores manually tracked tables", async () => {
    await connection.query(
      insertBasicQuery(MANUAL_BASIC_NAME, DEFAULT_SIMPLE_ID)
    );
    fastypest.markTableAsChanged(BASIC_TABLE_NAME);

    const inserted = await basicRepository.findOneBy({ name: MANUAL_BASIC_NAME });
    expect(inserted).toBeDefined();

    await fastypest.restoreData();

    const restored = await basicRepository.findOneBy({ name: MANUAL_BASIC_NAME });
    expect(restored).toBeNull();
  });

  const insertSimpleQuery = (name: string) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `INSERT INTO ${quotes}${SIMPLE_TABLE_NAME}${quotes} (name) VALUES ('${name}')`;
  };

  const insertBasicQuery = (name: string, simpleId: number) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `INSERT INTO ${quotes}${BASIC_TABLE_NAME}${quotes} (name, ${quotes}simpleId${quotes}) VALUES ('${name}', ${simpleId})`;
  };
});
