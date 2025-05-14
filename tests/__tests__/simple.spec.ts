import { IsNull, Not } from "typeorm";
import { getConnection } from "../config/orm.config";
import { seedCount } from "../config/seed.config";
import { Basic, Simple, User } from "../entities";
import { ConnectionUtil } from "../utils/connection.util";

const randomIndex = Math.floor(Math.random() * seedCount) + 1;

describe("Simple", () => {
  const connection = getConnection();
  const simpleRepository = connection.getRepository(Simple);
  let randomRow: Simple;
  const connectionUtil = new ConnectionUtil();

  beforeAll(async () => {
    const row = await simpleRepository.findOneBy({ id: randomIndex });
    if (!row) return;
    randomRow = row;
  });

  describe("Changes with typeorm methods", () => {
    it('"simple" table must have the same number of data as at the beginning', async () => {
      expect(await getSimpleCount()).toBe(seedCount);
    });

    describe("Modify value", () => {
      it("Row must be modified", async () => {
        const newName = "seed updated";
        await simpleRepository
          .createQueryBuilder("simple")
          .update({ name: newName })
          .where({ id: randomRow.id })
          .execute();

        const rowUpdated = await getRowByName(newName);

        expect(rowUpdated).toBeDefined();
        expect(rowUpdated?.id).toBe(randomRow.id);
      });

      it(`Row with index ${randomIndex} must have initial name`, async () => {
        const row = await getRow(randomRow.id);
        expect(row?.name).toBe(randomRow.name);
      });
    });

    describe("Delete new rows", () => {
      const name = "new manual seed";

      it("New row must be defined", async () => {
        await simpleRepository
          .createQueryBuilder("simple")
          .insert()
          .values({ name })
          .execute();

        const newRow = await getRowByName(name);
        expect(newRow).toBeDefined();
      });

      it("New row must be undefined", async () => {
        const newRow = await getRowByName(name);
        expect(newRow).toBeNull();
      });
    });

    describe("Add new rows", () => {
      const name = "new manual seed";

      it("New row must increase previous index", async () => {
        const lastRow = await getLastRow();
        if (!lastRow) throw new Error("Last row is not defined");
        const lastRowId = lastRow.id;

        await simpleRepository
          .createQueryBuilder("simple")
          .insert()
          .values({ name })
          .execute();

        const newRow = await getLastRow();
        if (!newRow) throw new Error("New row is not defined");

        expect(newRow.id).toBe(lastRowId + 1);
      });
    });
  });

  describe("Changes with queries", () => {
    describe("Restore all data", () => {
      it('"simple" table must have the same number of data as at the beginning', async () => {
        expect(await getSimpleCount()).toBe(seedCount);
      });

      it('"Simple" table must be empty', async () => {
        await connectionUtil.transaction(async (em) => {
          await em.delete(User, { id: Not(IsNull())}); // Delete for foreign key
          await em.delete(Basic, { name: Not(IsNull())}); // Delete for foreign key
          await em.delete(Simple, { id: Not(IsNull())});
        });

        expect(await getSimpleCount()).toBe(0);
      });

      it('After restore, "simple" table must have the same number of data as at the beginning', async () => {
        expect(await getSimpleCount()).toBe(seedCount);
      });
    });

    describe("Modify value", () => {
      it("Row must be modified", async () => {
        const newName = "seed updated";
        await connection.query(
          `UPDATE simple SET name = '${newName}' WHERE id = ${randomRow.id}`
        );

        const row = await getRow(randomRow.id);
        expect(row?.name).toBe(newName);
      });

      it(`Row with index ${randomIndex} must have initial name`, async () => {
        const row = await getRow(randomRow.id);
        expect(row?.name).toBe(randomRow.name);
      });
    });

    describe("Delete new rows", () => {
      const name = "new manual seed";

      it("New row must be defined", async () => {
        await connection.query(`INSERT INTO simple (name) VALUES ('${name}')`);

        const newRow = await getRowByName(name);
        expect(newRow).toBeDefined();
      });

      it("New row must be undefined", async () => {
        const newRow = await getRowByName(name);
        expect(newRow).toBeNull();
      });
    });

    describe("Add new rows", () => {
      const name = "new manual seed";

      it("New row must increase previous index", async () => {
        const lastRow = await getLastRow();
        if (!lastRow) throw new Error("Last row is not defined");
        const lastRowId = lastRow.id;

        await connection.query(`INSERT INTO simple (name) VALUES ('${name}')`);

        const newRow = await getLastRow();
        if (!newRow) throw new Error("New row is not defined");

        expect(newRow.id).toBe(lastRowId + 1);
      });
    });
  });

  const getSimpleCount = () => simpleRepository.count();

  const getLastRow = () =>
    simpleRepository
      .createQueryBuilder("simple")
      .orderBy("id", "DESC")
      .getOne();

  const getRow = (id: number) => simpleRepository.findOneBy({ id });

  const getRowByName = (name: string) => simpleRepository.findOneBy({ name });
});
