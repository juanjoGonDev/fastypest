import { IsNull, Not } from "typeorm";
import { getConnection } from "../config/orm.config";
import { seedCount } from "../config/seed.config";
import { DB_WITHOUT_QUOTES } from "../data/query";
import { User } from "../entities";
import { ConnectionUtil } from "../utils/connection.util";

const TRACKED_USER_ID = 1;

describe("User", () => {
  const connection = getConnection();
  const dbType = connection.options.type;
  const userRepository = connection.getRepository(User);
  let connectionUtil: ConnectionUtil;
  let trackedRow: User;

  beforeAll(async () => {
    const row = await userRepository.findOneBy({ id: TRACKED_USER_ID });
    if (!row) {
      throw new Error(`Seed row with id ${TRACKED_USER_ID} is not defined`);
    }
    trackedRow = row;
    connectionUtil = new ConnectionUtil(connection);
  });

  describe("Changes with typeorm methods", () => {
    it('"user" table must have the same number of data as at the beginning', async () => {
      expect(await getUserCount()).toBe(seedCount);
    });

    describe("Modify value", () => {
      it("Row must be modified", async () => {
        const newName = "seed updated";
        await userRepository
          .createQueryBuilder("user")
          .update({ name: newName })
          .where({ id: trackedRow.id })
          .execute();

        const rowUpdated = await getRowByName(newName);

        expect(rowUpdated).toBeDefined();
        expect(rowUpdated?.id).toBe(trackedRow.id);
      });

      it(`Row with index ${TRACKED_USER_ID} must have initial name`, async () => {
        const row = await getRow(trackedRow.id);
        expect(row?.name).toBe(trackedRow.name);
      });
    });

    describe("Delete new rows", () => {
      const name = "new manual seed";

      it("New row must be defined", async () => {
        await userRepository
          .createQueryBuilder("user")
          .insert()
          .values({ name, simpleId: trackedRow.id })
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
        await userRepository
          .createQueryBuilder("user")
          .delete()
          .where({ id: trackedRow.id })
          .execute();

        const deletedRow = await getRow(trackedRow.id);
        expect(deletedRow).toBeNull();
      });

      it(`Row with index ${TRACKED_USER_ID} must be restored`, async () => {
        const row = await getRow(trackedRow.id);
        expect(row?.name).toBe(trackedRow.name);
      });
    });

    describe("Add new rows", () => {
      const name = "new manual seed";

      it("New row must increase previous index", async () => {
        const lastRow = await getLastRow();
        if (!lastRow) throw new Error("Last row is not defined");
        const lastRowId = lastRow.id;

        await userRepository
          .createQueryBuilder("user")
          .insert()
          .values({ name, simpleId: trackedRow.id })
          .execute();

        const newRow = await getLastRow();
        if (!newRow) throw new Error("New row is not defined");

        expect(newRow.id).toBe(lastRowId + 1);
      });
    });
  });

  describe("Changes with queries", () => {
    describe("Restore all data", () => {
      it('"user" table must have the same number of data as at the beginning', async () => {
        expect(await getUserCount()).toBe(seedCount);
      });

      it('"User" table must be empty', async () => {
        await connectionUtil.transaction(async (em) => {
          await em.delete(User, { id: Not(IsNull()) });
        });

        expect(await getUserCount()).toBe(0);
      });

      it('After restore, "user" table must have the same number of data as at the beginning', async () => {
        expect(await getUserCount()).toBe(seedCount);
      });
    });

    describe("Modify value", () => {
      it("Row must be modified", async () => {
        const newName = "seed updated";
        await connection.query(updateQuery(newName, trackedRow.id));

        const row = await getRow(trackedRow.id);
        expect(row?.name).toBe(newName);
      });

      it(`Row with index ${TRACKED_USER_ID} must have initial name`, async () => {
        const row = await getRow(trackedRow.id);
        expect(row?.name).toBe(trackedRow.name);
      });
    });

    describe("Delete new rows", () => {
      const name = "new manual seed";

      it("New row must be defined", async () => {
        await connection.query(insertQuery(name, trackedRow.id));

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
        await connection.query(deleteQuery(trackedRow.id));

        const deletedRow = await getRow(trackedRow.id);
        expect(deletedRow).toBeNull();
      });

      it(`Row with index ${TRACKED_USER_ID} must be restored`, async () => {
        const row = await getRow(trackedRow.id);
        expect(row?.name).toBe(trackedRow.name);
      });
    });

    describe("Add new rows", () => {
      const name = "new manual seed";

      it("New row must increase previous index", async () => {
        const lastRow = await getLastRow();
        if (!lastRow) throw new Error("Last row is not defined");
        const lastRowId = lastRow.id;

        await connection.query(insertQuery(name, trackedRow.id));

        const newRow = await getLastRow();
        if (!newRow) throw new Error("New row is not defined");

        expect(newRow.id).toBe(lastRowId + 1);
      });
    });
  });

  const getUserCount = () => userRepository.count();

  const getLastRow = () =>
    userRepository.createQueryBuilder("user").orderBy("id", "DESC").getOne();

  const getRow = (id: number) => userRepository.findOneBy({ id });
  const insertQuery = (name: string, simpleId: number) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `INSERT INTO ${quotes}user${quotes} (name, ${quotes}simpleId${quotes}) VALUES ('${name}', ${simpleId})`;
  };
  const updateQuery = (name: string, id: number) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `UPDATE ${quotes}user${quotes} SET name = '${name}' WHERE id = ${id}`;
  };
  const deleteQuery = (id: number) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `DELETE FROM ${quotes}user${quotes} WHERE id = ${id}`;
  };

  const getRowByName = (name: string) => userRepository.findOneBy({ name });
});
