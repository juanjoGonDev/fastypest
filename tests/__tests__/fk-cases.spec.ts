import { DataSource } from "typeorm";
import { Fastypest, LoggingDetailLevel } from "../../src/core";
import { getConnection } from "../config/orm.config";
import { CycleA, CycleB, FkChild, FkParent } from "../entities";

const PARENT_ID_A = 1;
const PARENT_ID_B = 10;
const CHILD_ID = 1;
const CYCLE_ID = 1;

const PARENT_ORIGINAL_VALUE = "parent seed";
const PARENT_UPDATED_VALUE = "parent updated";
const CHILD_ORIGINAL_VALUE = "child seed";
const CYCLE_A_ORIGINAL_VALUE = "cycle a seed";
const CYCLE_A_UPDATED_VALUE = "cycle a updated";
const CYCLE_B_ORIGINAL_VALUE = "cycle b seed";
const CYCLE_B_UPDATED_VALUE = "cycle b updated";

describe("Foreign key cases", () => {
  const connection: DataSource = getConnection();
  let fastypest: Fastypest;
  const parentRepository = connection.getRepository(FkParent);
  const childRepository = connection.getRepository(FkChild);
  const cycleARepository = connection.getRepository(CycleA);
  const cycleBRepository = connection.getRepository(CycleB);

  beforeAll(async () => {
    await parentRepository.insert({
      idA: PARENT_ID_A,
      idB: PARENT_ID_B,
      valueName: PARENT_ORIGINAL_VALUE,
    });
    await childRepository.insert({
      id: CHILD_ID,
      parentIdA: PARENT_ID_A,
      parentIdB: PARENT_ID_B,
      valueName: CHILD_ORIGINAL_VALUE,
    });
    await cycleARepository.insert({
      id: CYCLE_ID,
      bId: null,
      valueName: CYCLE_A_ORIGINAL_VALUE,
    });
    await cycleBRepository.insert({
      id: CYCLE_ID,
      aId: null,
      valueName: CYCLE_B_ORIGINAL_VALUE,
    });

    fastypest = new Fastypest(connection, {
      logging: { enabled: true, detail: LoggingDetailLevel.Simple },
    });
    await fastypest.init();
  });

  afterEach(async () => {
    await fastypest.restoreData();
  });

  it("restores dependent rows for composite foreign keys when only parent table changes", async () => {
    await parentRepository
      .createQueryBuilder("edge_fk_parent")
      .update({ valueName: PARENT_UPDATED_VALUE })
      .where({ idA: PARENT_ID_A, idB: PARENT_ID_B })
      .execute();

    const updatedParent = await parentRepository.findOneBy({
      idA: PARENT_ID_A,
      idB: PARENT_ID_B,
    });
    expect(updatedParent?.valueName).toBe(PARENT_UPDATED_VALUE);

    await fastypest.restoreData();

    const restoredParent = await parentRepository.findOneBy({
      idA: PARENT_ID_A,
      idB: PARENT_ID_B,
    });
    const child = await childRepository.findOneBy({ id: CHILD_ID });
    const childCount = await childRepository.count();

    expect(restoredParent?.valueName).toBe(PARENT_ORIGINAL_VALUE);
    expect(childCount).toBe(1);
    expect(child?.valueName).toBe(CHILD_ORIGINAL_VALUE);
    expect(Number(child?.parentIdA)).toBe(PARENT_ID_A);
    expect(Number(child?.parentIdB)).toBe(PARENT_ID_B);
  });

  it("restores correctly when cyclic foreign key metadata exists", async () => {
    await cycleARepository
      .createQueryBuilder("edge_cycle_a")
      .update({ valueName: CYCLE_A_UPDATED_VALUE })
      .where({ id: CYCLE_ID })
      .execute();
    await cycleBRepository
      .createQueryBuilder("edge_cycle_b")
      .update({ valueName: CYCLE_B_UPDATED_VALUE })
      .where({ id: CYCLE_ID })
      .execute();

    const updatedCycleA = await cycleARepository.findOneBy({ id: CYCLE_ID });
    const updatedCycleB = await cycleBRepository.findOneBy({ id: CYCLE_ID });
    expect(updatedCycleA?.valueName).toBe(CYCLE_A_UPDATED_VALUE);
    expect(updatedCycleB?.valueName).toBe(CYCLE_B_UPDATED_VALUE);

    await fastypest.restoreData();

    const restoredCycleA = await cycleARepository.findOneBy({ id: CYCLE_ID });
    const restoredCycleB = await cycleBRepository.findOneBy({ id: CYCLE_ID });
    const cycleBCount = await cycleBRepository.count();

    expect(restoredCycleA?.valueName).toBe(CYCLE_A_ORIGINAL_VALUE);
    expect(cycleBCount).toBe(1);
    expect(restoredCycleB?.valueName).toBe(CYCLE_B_ORIGINAL_VALUE);
  });
});
