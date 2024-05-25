import { seedCount } from "../config";
import { getConnection } from "../config/orm.config";
import { Simple, User } from "../entities";
import { simple } from "../seeds";
import { ConnectionUtil } from "../utils";

const SEED = Object.assign({}, simple);

describe("Simple", () => {
  const connection = getConnection();
  const randomSimpleIndex = Math.floor(Math.random() * seedCount) + 1;
  const simpleRepository = connection.getRepository(Simple);
  const connectionUtil = new ConnectionUtil();

  describe("Changes with typeorm methods", () => {
    describe("Modify value", () => {
      it("Row must be modified", async () => {
        const newName = "seed updated";
        await simpleRepository
          .createQueryBuilder("simple")
          .update({ name: newName })
          .where({ id: randomSimpleIndex })
          .execute();

        const rowUpdated = await getRowByName(newName);

        expect(rowUpdated).toBeDefined();
        expect(rowUpdated?.id).toBe(randomSimpleIndex);
      });

      it(`Row with index ${randomSimpleIndex} must have initial name`, async () => {
        const row = await getRow(randomSimpleIndex);
        expect(row?.name).toBe(SEED[randomSimpleIndex - 1].name);
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
          await em.delete(User, {}); // Delete for foreign key
          await em.delete(Simple, {});
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
          `UPDATE simple SET name = '${newName}' WHERE id = ${randomSimpleIndex}`
        );

        const row = await getRow(randomSimpleIndex);
        expect(row?.name).toBe(newName);
      });

      it(`Row with index ${randomSimpleIndex} must have initial name`, async () => {
        const row = await getRow(randomSimpleIndex);
        expect(row?.name).toBe(SEED[randomSimpleIndex - 1].name);
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
