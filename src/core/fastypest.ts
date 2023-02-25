import { Connection, DataSource, EntityManager } from "typeorm";
import { SQLScript } from "./sql-script";

export class Fastypest {
  private manager: EntityManager;
  private tables: Set<string> = new Set();
  private scriptSQL: SQLScript;

  constructor(connection: DataSource | Connection) {
    this.manager = connection.manager;
    this.scriptSQL = new SQLScript(connection.options.type);
  }

  async init() {
    await this.manager.transaction(async (em) => {
      (await em.query(this.scriptSQL.getQuery("getTables"))).map(
        (row: Record<string, string>) => {
          this.tables.add(row.name);
        }
      );

      await Promise.all(
        [...this.tables].map(async (tableName) => {
          await em.query(
            this.scriptSQL.getQuery("createTempTable", { tableName })
          );
        })
      );
    });
  }

  async restoreData() {
    await this.manager.transaction(async (em) => {
      await em.query(this.scriptSQL.getQuery("foreignKey.disable"));

      await Promise.all(
        [...this.tables].map(async (tableName) => {
          await em.query(
            this.scriptSQL.getQuery("truncateTable", { tableName })
          );
          await em.query(this.scriptSQL.getQuery("restoreData", { tableName }));
        })
      );

      await em.query(this.scriptSQL.getQuery("foreignKey.enable"));
    });
  }

  async clearTempTables() {
    await this.manager.transaction(async (em) => {
      await Promise.all(
        [...this.tables].map(async (tableName) => {
          await em.query(
            await em.query(
              this.scriptSQL.getQuery("dropTempTable", { tableName })
            )
          );
        })
      );
    });

    this.tables.clear();
  }
}
