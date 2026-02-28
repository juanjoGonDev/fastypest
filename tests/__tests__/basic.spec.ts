import { IsNull, Not } from "typeorm";
import { getConnection } from "../config/orm.config";
import { seedCount } from "../config/seed.config";
import { DB_WITHOUT_QUOTES } from "../data/query";
import { Basic } from "../entities";
import { ConnectionUtil } from "../utils/connection.util";

const randomIndex = Math.floor(Math.random() * seedCount) + 1;

describe("Basic", () => {
  const connection = getConnection();
  const dbType = connection.options.type;
  const basicRepository = connection.getRepository(Basic);
  const connectionUtil = new ConnectionUtil();
  let randomRow: Basic;

  beforeAll(async () => {
    const row = await basicRepository.findOneBy({
      name: `Basic ${randomIndex}`,
    });
    if (!row) return;
    randomRow = row;
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
          .where({ name: randomRow.name })
          .execute();

        const rowUpdated = await getRowByName(newName);

        expect(rowUpdated).toBeDefined();
        expect(rowUpdated?.name).toBe(newName);
      });

      it(`Row with name "Basic ${randomIndex}" must have initial name`, async () => {
        const row = await getRowByName(randomRow.name);
        expect(row?.name).toBe(randomRow.name);
      });
    });

    describe("Delete new rows", () => {
      const name = "new manual seed";

      it("New row must be defined", async () => {
        await basicRepository
          .createQueryBuilder("basic")
          .insert()
          .values({ name, simpleId: randomRow.simpleId })
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
          `UPDATE basic SET name = '${newName}' WHERE name = '${randomRow.name}'`,
        );

        const row = await getRowByName(newName);
        expect(row?.name).toBe(newName);
      });

      it(`Row with name "Basic ${randomIndex}" must have initial name`, async () => {
        const row = await getRowByName(randomRow.name);
        expect(row?.name).toBe(randomRow.name);
      });
    });

    describe("Delete new rows", () => {
      const name = "new manual seed";

      it("New row must be defined", async () => {
        await connection.query(insertQuery(name, randomRow.simpleId));

        const newRow = await getRowByName(name);
        expect(newRow).toBeDefined();
      });

      it("New row must be undefined", async () => {
        const newRow = await getRowByName(name);
        expect(newRow).toBeNull();
      });
    });
  });

  const getBasicCount = () => basicRepository.count();
  const insertQuery = (name: string, simpleId: number) => {
    const quotes = DB_WITHOUT_QUOTES.includes(dbType) ? "" : '"';
    return `INSERT INTO ${quotes}basic${quotes} (name, ${quotes}simpleId${quotes}) VALUES ('${name}', ${simpleId})`;
  };

  const getRowByName = (name: string) => basicRepository.findOneBy({ name });
});
