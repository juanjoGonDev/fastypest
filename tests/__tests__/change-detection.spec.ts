import { DataSource } from "typeorm";
import {
  Fastypest,
  LoggingDetailLevel,
} from "../../src/core";
import { detectQueryEvents } from "../../src/core/query-mediator";
import { getConnection } from "../config/orm.config";
import { DB_WITHOUT_QUOTES } from "../data/query";
import { Basic, Simple, User } from "../entities";

const TRACKED_BASIC_NAME = "tracked basic";
const RAW_SIMPLE_NAME = "raw simple";
const RAW_USER_NAME = "raw user";
const COMMENTED_UPDATE_NAME = "commented update basic";
const BASIC_TABLE_NAME = "basic";
const SIMPLE_TABLE_NAME = "simple";
const USER_TABLE_NAME = "user";
const DEFAULT_SIMPLE_ID = 1;
const INVALID_SIMPLE_ID = 999_999;
const INVALID_BASIC_NAME = "invalid basic foreign key";
const INVALID_USER_NAME = "invalid user foreign key";
const DROP_MISSING_TABLE_QUERY = "DROP TABLE IF EXISTS fastypest_missing_table";
const ORIGINAL_BASIC_NAME = "Basic 1";

describe("Change detection strategy", () => {
  const connection: DataSource = getConnection();
  let fastypest: Fastypest;
  const basicRepository = connection.getRepository(Basic);
  const simpleRepository = connection.getRepository(Simple);
  const userRepository = connection.getRepository(User);
  const dbType = connection.options.type;

  beforeAll(async () => {
    fastypest = new Fastypest(connection, {
      logging: { enabled: true, detail: LoggingDetailLevel.Detailed },
    });
    await fastypest.init();
  });

  afterEach(async () => {
    await fastypest.restoreData();
  });

  it("restores changes detected by the query mediator", async () => {
    const initialCount = await basicRepository.count();
    await basicRepository
      .createQueryBuilder(BASIC_TABLE_NAME)
      .insert()
      .values({ name: TRACKED_BASIC_NAME, simpleId: DEFAULT_SIMPLE_ID })
      .execute();

    const inserted = await basicRepository.findOneBy({
      name: TRACKED_BASIC_NAME,
    });
    expect(inserted).toBeDefined();

    await fastypest.restoreData();

    const restored = await basicRepository.findOneBy({
      name: TRACKED_BASIC_NAME,
    });
    expect(restored).toBeNull();
    const count = await basicRepository.count();
    expect(count).toBe(initialCount);
  });

  it('restores dependent tables when only "simple" is tracked', async () => {
    const initialSimpleCount = await simpleRepository.count();
    const initialBasicCount = await basicRepository.count();
    const initialUserCount = await userRepository.count();
    const initialSimple = await simpleRepository.findOneBy({ id: DEFAULT_SIMPLE_ID });
    const initialBasic = await basicRepository.findOneBy({ simpleId: DEFAULT_SIMPLE_ID });
    const initialUser = await userRepository.findOneBy({ simpleId: DEFAULT_SIMPLE_ID });
    if (!initialSimple) {
      throw new Error(`Seed row with id ${DEFAULT_SIMPLE_ID} is not defined`);
    }
    if (!initialBasic) {
      throw new Error(
        `Seed row on table "${BASIC_TABLE_NAME}" with simpleId ${DEFAULT_SIMPLE_ID} is not defined`,
      );
    }
    if (!initialUser) {
      throw new Error(
        `Seed row on table "${USER_TABLE_NAME}" with simpleId ${DEFAULT_SIMPLE_ID} is not defined`,
      );
    }

    await simpleRepository
      .createQueryBuilder(SIMPLE_TABLE_NAME)
      .update({ name: RAW_SIMPLE_NAME })
      .where({ id: DEFAULT_SIMPLE_ID })
      .execute();

    const updatedSimple = await simpleRepository.findOneBy({ id: DEFAULT_SIMPLE_ID });
    expect(updatedSimple?.name).toBe(RAW_SIMPLE_NAME);

    await fastypest.restoreData();

    const restoredSimple = await simpleRepository.findOneBy({
      id: DEFAULT_SIMPLE_ID,
    });
    const simpleCount = await simpleRepository.count();
    const basicCount = await basicRepository.count();
    const userCount = await userRepository.count();
    const restoredBasic = await basicRepository.findOneBy({
      name: initialBasic.name,
    });
    const restoredUser = await userRepository.findOneBy({
      id: initialUser.id,
    });

    expect(restoredSimple?.name).toBe(initialSimple.name);
    expect(simpleCount).toBe(initialSimpleCount);
    expect(basicCount).toBe(initialBasicCount);
    expect(userCount).toBe(initialUserCount);
    expect(restoredBasic?.simpleId).toBe(DEFAULT_SIMPLE_ID);
    expect(restoredUser?.simpleId).toBe(DEFAULT_SIMPLE_ID);
    expect(restoredBasic?.name).toBe(initialBasic.name);
    expect(restoredUser?.name).toBe(initialUser.name);
  });

  it("keeps foreign key checks active after restore", async () => {
    await simpleRepository
      .createQueryBuilder(SIMPLE_TABLE_NAME)
      .update({ name: RAW_SIMPLE_NAME })
      .where({ id: DEFAULT_SIMPLE_ID })
      .execute();

    await fastypest.restoreData();

    await expect(
      basicRepository
        .createQueryBuilder(BASIC_TABLE_NAME)
        .insert()
        .values({ name: INVALID_BASIC_NAME, simpleId: INVALID_SIMPLE_ID })
        .execute(),
    ).rejects.toThrow();

    await expect(
      userRepository
        .createQueryBuilder(USER_TABLE_NAME)
        .insert()
        .values({ name: INVALID_USER_NAME, simpleId: INVALID_SIMPLE_ID })
        .execute(),
    ).rejects.toThrow();
  });

  it('restores changes detected from raw SQL on "simple"', async () => {
    await connection.query(insertSimpleQuery(RAW_SIMPLE_NAME));

    const inserted = await simpleRepository.findOneBy({
      name: RAW_SIMPLE_NAME,
    });
    expect(inserted).toBeDefined();

    await fastypest.restoreData();

    const restored = await simpleRepository.findOneBy({
      name: RAW_SIMPLE_NAME,
    });
    expect(restored).toBeNull();
  });

  it('restores changes detected from raw SQL on related "user"', async () => {
    await connection.query(insertUserQuery(RAW_USER_NAME, DEFAULT_SIMPLE_ID));

    const inserted = await connection.query(
      selectUserByNameQuery(RAW_USER_NAME),
    );
    expect(inserted).toHaveLength(1);

    await fastypest.restoreData();

    const restored = await connection.query(
      selectUserByNameQuery(RAW_USER_NAME),
    );
    expect(restored).toHaveLength(0);
  });

  it("falls back to full restore when an unsafe query is detected", async () => {
    await connection.query(insertSimpleQuery(RAW_SIMPLE_NAME));
    await connection.query(commentedUpdateBasicQuery());
    await connection.query(DROP_MISSING_TABLE_QUERY);

    const inserted = await simpleRepository.findOneBy({
      name: RAW_SIMPLE_NAME,
    });
    expect(inserted).toBeDefined();
    const updated = await basicRepository.findOneBy({
      name: COMMENTED_UPDATE_NAME,
    });
    expect(updated).toBeDefined();

    await fastypest.restoreData();

    const restoredSimple = await simpleRepository.findOneBy({
      name: RAW_SIMPLE_NAME,
    });
    expect(restoredSimple).toBeNull();
    const restoredBasic = await basicRepository.findOneBy({
      name: ORIGINAL_BASIC_NAME,
    });
    expect(restoredBasic).toBeDefined();
  });

  describe("query parser", () => {
    it("detects touched tables for statements with schema and quotes", () => {
      const events = detectQueryEvents(
        "mysql",
        "INSERT INTO `test`.`user` (name, simpleId) VALUES ('raw user', 1)",
      );

      expect(events).toStrictEqual([{ type: "tableTouched", tableName: "user" }]);
    });

    it("detects touched tables across multiple statements", () => {
      const query = [
        "",
        "INSERT INTO simple (name) VALUES ('raw simple')",
        "UPDATE basic SET name = 'tracked basic' WHERE name = 'Basic 1'",
      ].join("; ");
      const events = detectQueryEvents("mysql", query);

      expect(events).toStrictEqual([
        { type: "tableTouched", tableName: "simple" },
        { type: "tableTouched", tableName: "basic" },
      ]);
    });

    it("marks unsupported mutations as unsafe", () => {
      const events = detectQueryEvents("mysql", "DROP TABLE IF EXISTS sample");

      expect(events).toStrictEqual([{ type: "unsupportedMutation" }]);
    });

    it("returns ignored for databases without query detection configuration", () => {
      const events = detectQueryEvents(
        "sqljs",
        "INSERT INTO simple (name) VALUES ('ignored')",
      );

      expect(events).toStrictEqual([{ type: "ignored" }]);
    });

    it("returns ignored when query has no executable statements", () => {
      const events = detectQueryEvents("mysql", "   ;  ; ");

      expect(events).toStrictEqual([{ type: "ignored" }]);
    });
  });

  const insertSimpleQuery = (name: string) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `INSERT INTO ${quotes}${SIMPLE_TABLE_NAME}${quotes} (name) VALUES ('${name}')`;
  };

  const insertUserQuery = (name: string, simpleId: number) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `INSERT INTO ${quotes}${USER_TABLE_NAME}${quotes} (name, ${quotes}simpleId${quotes}) VALUES ('${name}', ${simpleId})`;
  };

  const selectUserByNameQuery = (name: string) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `SELECT * FROM ${quotes}${USER_TABLE_NAME}${quotes} WHERE name = '${name}'`;
  };

  const commentedUpdateBasicQuery = () => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `/* unsafe mutation */ UPDATE ${quotes}${BASIC_TABLE_NAME}${quotes} SET name = '${COMMENTED_UPDATE_NAME}' WHERE name = '${ORIGINAL_BASIC_NAME}'`;
  };
});
