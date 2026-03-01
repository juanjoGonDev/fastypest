import { IsNull, Not } from "typeorm";
import { getConnection } from "../config/orm.config";
import { seedCount } from "../config/seed.config";
import { DB_WITHOUT_QUOTES } from "../data/query";
import { Basic } from "../entities";
import { ConnectionUtil } from "../utils/connection.util";

const TRACKED_BASIC_INDEX = 1;
const TRACKED_BASIC_NAME = `Basic ${TRACKED_BASIC_INDEX}`;

describe("Basic", () => {
  const connection = getConnection();
  const dbType = connection.options.type;
  const basicRepository = connection.getRepository(Basic);
  let connectionUtil: ConnectionUtil;
  let trackedRow: Basic;

  beforeAll(async () => {
    const row = await basicRepository.findOneBy({ name: TRACKED_BASIC_NAME });
    if (!row) {
      throw new Error(`Seed row "${TRACKED_BASIC_NAME}" is not defined`);
    }
    trackedRow = row;
    connectionUtil = new ConnectionUtil(connection);
  });

  describe("Changes with typeorm methods", () => {
    it('"basic" table must have the same number of data as at the beginning', async () => {
      expect(await getBasicCount()).toBe(seedCount);
    });

    describe("Modify value", () => {
      it("Row must be modified", async () => {
        const newName = "seed updated";
        await basicRepository
          .createQueryBuilder("basic")
          .update({ name: newName })
          .where({ name: trackedRow.name })
          .execute();

        const rowUpdated = await getRowByName(newName);

        expect(rowUpdated).toBeDefined();
        expect(rowUpdated?.name).toBe(newName);
      });

      it(`Row with name "${TRACKED_BASIC_NAME}" must have initial name`, async () => {
        const row = await getRowByName(trackedRow.name);
        expect(row?.name).toBe(trackedRow.name);
      });
    });

    describe("Delete new rows", () => {
      const name = "new manual seed";

      it("New row must be defined", async () => {
        await basicRepository
          .createQueryBuilder("basic")
          .insert()
          .values({ name, simpleId: trackedRow.simpleId })
          .execute();

        const newRow = await getRowByName(name);
        expect(newRow).toBeDefined();
      });

      it("New row must be undefined", async () => {
        const newRow = await getRowByName(name);
        expect(newRow).toBeNull();
      });
    });

    describe("Delete seeded rows", () => {
      it("Seed row must be deleted", async () => {
        await basicRepository
          .createQueryBuilder("basic")
          .delete()
          .where({ name: trackedRow.name })
          .execute();

        const deletedRow = await getRowByName(trackedRow.name);
        expect(deletedRow).toBeNull();
      });

      it(`Row with name "${TRACKED_BASIC_NAME}" must be restored`, async () => {
        const row = await getRowByName(trackedRow.name);
        expect(row?.name).toBe(trackedRow.name);
      });
    });
  });

  describe("Changes with queries", () => {
    describe("Restore all data", () => {
      it('"basic" table must have the same number of data as at the beginning', async () => {
        expect(await getBasicCount()).toBe(seedCount);
      });

      it('"Basic" table must be empty', async () => {
        await connectionUtil.transaction(async (em) => {
          await em.delete(Basic, { name: Not(IsNull()) });
        });

        expect(await getBasicCount()).toBe(0);
      });

      it('After restore, "basic" table must have the same number of data as at the beginning', async () => {
        expect(await getBasicCount()).toBe(seedCount);
      });
    });

    describe("Modify value", () => {
      it("Row must be modified", async () => {
        const newName = "seed updated";
        await connection.query(
          `UPDATE basic SET name = '${newName}' WHERE name = '${trackedRow.name}'`,
        );

        const row = await getRowByName(newName);
        expect(row?.name).toBe(newName);
      });

      it(`Row with name "${TRACKED_BASIC_NAME}" must have initial name`, async () => {
        const row = await getRowByName(trackedRow.name);
        expect(row?.name).toBe(trackedRow.name);
      });
    });

    describe("Delete new rows", () => {
      const name = "new manual seed";

      it("New row must be defined", async () => {
        await connection.query(insertQuery(name, trackedRow.simpleId));

        const newRow = await getRowByName(name);
        expect(newRow).toBeDefined();
      });

      it("New row must be undefined", async () => {
        const newRow = await getRowByName(name);
        expect(newRow).toBeNull();
      });
    });

    describe("Delete seeded rows", () => {
      it("Seed row must be deleted", async () => {
        await connection.query(deleteQuery(trackedRow.name));

        const deletedRow = await getRowByName(trackedRow.name);
        expect(deletedRow).toBeNull();
      });

      it(`Row with name "${TRACKED_BASIC_NAME}" must be restored`, async () => {
        const row = await getRowByName(trackedRow.name);
        expect(row?.name).toBe(trackedRow.name);
      });
    });
  });

  const getBasicCount = () => basicRepository.count();
  const insertQuery = (name: string, simpleId: number) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `INSERT INTO ${quotes}basic${quotes} (name, ${quotes}simpleId${quotes}) VALUES ('${name}', ${simpleId})`;
  };
  const deleteQuery = (name: string) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `DELETE FROM ${quotes}basic${quotes} WHERE name = '${name}'`;
  };

  const getRowByName = (name: string) => basicRepository.findOneBy({ name });
});
