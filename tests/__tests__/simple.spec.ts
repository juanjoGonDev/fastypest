import { getConnection } from "../config/orm.config";
import { Simple } from "../entities";
import { seedCount, simple } from "../seeds";

describe("Simple", () => {
  const connection = getConnection();
  const randomSimpleIndex = Math.floor(Math.random() * simple.length);

  describe("Changes with typeorm methods", () => {
    describe("Restore all data", () => {
      it('"simple" table must have the same number of data as at the beginning', async () => {
        expect(await getSimpleCount()).toBe(seedCount);
      });

      it('"Simple" table must be empty', async () => {
        await connection
          .createQueryBuilder(Simple, "simple")
          .delete()
          .execute();
        expect(await getSimpleCount()).toBe(0);
      });

      it('After restore, "simple" table must have the same number of data as at the beginning', async () => {
        expect(await getSimpleCount()).toBe(seedCount);
      });
    });

    describe("Modify value", () => {
      it("Row must be modified", async () => {
        const update = await connection
          .createQueryBuilder(Simple, "simple")
          .update({ name: "seed updated" })
          .where({ id: randomSimpleIndex })
          .execute();

        expect(update.affected).toBeGreaterThan(0);
      });

      it(`Row with index ${randomSimpleIndex} must have initial name`, async () => {
        const row = await getRow(randomSimpleIndex);
        expect(row?.name).toBe(simple[randomSimpleIndex - 1].name);
      });
    });

    describe("Delete new rows", () => {
      it("New row must be defined", async () => {
        await connection
          .createQueryBuilder(Simple, "simple")
          .insert()
          .values({ name: "new manual seed" })
          .execute();

        const newRow = await getRowByName("new manual seed");
        expect(newRow).toBeDefined();
      });

      it("New row must be undefined", async () => {
        const newRow = await getRowByName("new manual seed");
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
        await connection.query("DELETE FROM simple");
        expect(await getSimpleCount()).toBe(0);
      });

      it('After restore, "simple" table must have the same number of data as at the beginning', async () => {
        expect(await getSimpleCount()).toBe(seedCount);
      });
    });

    describe("Modify value", () => {
      it("Row must be modified", async () => {
        await connection.query(
          `UPDATE simple SET name = 'seed updated' WHERE id = ${randomSimpleIndex}`
        );

        const row = await getRow(randomSimpleIndex);
        expect(row?.name).toBe("seed updated");
      });

      it(`Row with index ${randomSimpleIndex} must have initial name`, async () => {
        const row = await getRow(randomSimpleIndex);
        expect(row?.name).toBe(simple[randomSimpleIndex - 1].name);
      });
    });

    describe("Delete new rows", () => {
      it("New row must be defined", async () => {
        await connection.query(
          'INSERT INTO simple (name) VALUE ("new manual seed")'
        );

        const newRow = await getRowByName("new manual seed");
        expect(newRow).toBeDefined();
      });

      it("New row must be undefined", async () => {
        const newRow = await getRowByName("new manual seed");
        expect(newRow).toBeNull();
      });
    });
  });

  const getSimpleCount = () => {
    return connection.createQueryBuilder(Simple, "simple").getCount();
  };

  const getRow = (id: number) =>
    connection.createQueryBuilder(Simple, "simple").where({ id }).getOne();

  const getRowByName = (name: string) =>
    connection.createQueryBuilder(Simple, "simple").where({ name }).getOne();
});
