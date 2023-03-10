import { seedCount } from "../config";
import { getConnection } from "../config/orm.config";
import { Simple } from "../entities";
import { simple } from "../seeds";
import { ConnectionUtil } from "../utils";

describe("Simple", () => {
  const connection = getConnection();
  const randomSimpleIndex = Math.floor(Math.random() * seedCount);
  const simpleRepository = connection.getRepository(Simple);
  const connectionUtil = new ConnectionUtil();

  describe("Changes with typeorm methods", () => {
    describe("Restore all data", () => {
      it('"simple" table must have the same number of data as at the beginning', async () => {
        expect(await getSimpleCount()).toBe(seedCount);
      });

      it('"Simple" table must be empty', async () => {
        await connectionUtil.transaction(async (em) => {
          const repository = em.getRepository(Simple);
          await repository.clear();
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
        expect(row?.name).toBe(simple[randomSimpleIndex - 1].name);
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
  });

  describe("Changes with queries", () => {
    describe("Restore", () => {
      it('"simple" table must have the same number of data as at the beginning', async () => {
        expect(await getSimpleCount()).toBe(seedCount);
      });

      it('"Simple" table must be empty', async () => {
        await connectionUtil.transaction(async (em) => {
          await em.query("DELETE FROM simple WHERE id <> 0");
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
        expect(row?.name).toBe(simple[randomSimpleIndex - 1].name);
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
  });

  const getSimpleCount = () => simpleRepository.count();

  const getRow = (id: number) => simpleRepository.findOneBy({ id });

  const getRowByName = (name: string) => simpleRepository.findOneBy({ name });
});
