import { Connection, DataSource, EntityManager } from "typeorm";
import { SQLScript } from "./sql-script";

export class Fastypest extends SQLScript {
  private manager: EntityManager;
  private tables: Set<string> = new Set();

  constructor(connection: DataSource | Connection) {
    super(connection.options.type);
    this.manager = connection.manager;
  }

  async init() {
    await this.manager.transaction(async (em) => {
      (await em.query(this.getQuery("getTables"))).map(
        (row: Record<string, string>) => {
          this.tables.add(row.name);
        }
      );

      await Promise.all(
        [...this.tables].map(async (tableName) => {
          await em.query(this.getQuery("createTempTable", { tableName }));
        })
      );
    });
  }

  async restoreData() {
    await this.manager.transaction(async (em) => {
      await em.query(this.getQuery("foreignKey.disable"));

      await Promise.all(
        [...this.tables].map(async (tableName) => {
          await em.query(this.getQuery("truncateTable", { tableName }));
          await em.query(this.getQuery("restoreData", { tableName }));
        })
      );

      await em.query(this.getQuery("foreignKey.enable"));
    });
  }

  async clearTempTables() {
    await this.manager.transaction(async (em) => {
      await Promise.all(
        [...this.tables].map(async (tableName) => {
          await em.query(
            await em.query(this.getQuery("dropTempTable", { tableName }))
          );
        })
      );
    });

    this.tables.clear();
  }
}
