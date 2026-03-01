import { DataSource } from "typeorm";
import { ChangeDetectionStrategy, Fastypest } from "../../src/core";
import { getConnection } from "../config/orm.config";
import { seedCount } from "../config/seed.config";
import { Basic, Simple, User } from "../entities";

const ORIGINAL_SIMPLE_NAME = "Simple 1";
const ORIGINAL_BASIC_NAME = "Basic 1";
const ORIGINAL_USER_NAME = "User 1";
const UPDATED_SIMPLE_NAME = "updated by none strategy";
const UPDATED_BASIC_NAME = "updated basic by none strategy";
const UPDATED_USER_NAME = "updated user by none strategy";

describe("None change detection strategy", () => {
  const connection: DataSource = getConnection();
  let fastypest: Fastypest;
  const simpleRepository = connection.getRepository(Simple);
  const basicRepository = connection.getRepository(Basic);
  const userRepository = connection.getRepository(User);

  beforeAll(async () => {
    fastypest = new Fastypest(connection, {
      changeDetectionStrategy: ChangeDetectionStrategy.None,
    });
    await fastypest.init();
  });

  afterEach(async () => {
    await fastypest.restoreData();
  });

  it("restores all tables after mixed mutations", async () => {
    await simpleRepository
      .createQueryBuilder("simple")
      .update({ name: UPDATED_SIMPLE_NAME })
      .where({ name: ORIGINAL_SIMPLE_NAME })
      .execute();
    await basicRepository
      .createQueryBuilder("basic")
      .update({ name: UPDATED_BASIC_NAME })
      .where({ name: ORIGINAL_BASIC_NAME })
      .execute();
    await userRepository
      .createQueryBuilder("user")
      .update({ name: UPDATED_USER_NAME })
      .where({ name: ORIGINAL_USER_NAME })
      .execute();

    await fastypest.restoreData();

    const restoredSimple = await simpleRepository.findOneBy({
      name: ORIGINAL_SIMPLE_NAME,
    });
    const restoredBasic = await basicRepository.findOneBy({
      name: ORIGINAL_BASIC_NAME,
    });
    const restoredUser = await userRepository.findOneBy({
      name: ORIGINAL_USER_NAME,
    });
    const simpleCount = await simpleRepository.count();
    const basicCount = await basicRepository.count();
    const userCount = await userRepository.count();

    expect(restoredSimple).toBeDefined();
    expect(restoredBasic).toBeDefined();
    expect(restoredUser).toBeDefined();
    expect(simpleCount).toBe(seedCount);
    expect(basicCount).toBe(seedCount);
    expect(userCount).toBe(seedCount);
  });
});
