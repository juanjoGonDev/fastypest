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
      await this.detectTables(em);

      await Promise.all(
        [...this.tables].map(async (tableName) => {
          await em.query(this.getQuery("createTempTable", { tableName }));
        })
      );
    });
  }

  async detectTables(em: EntityManager) {
    (await em.query(this.getQuery("getTables"))).map(
      (row: Record<string, string>) => {
        this.tables.add(row.name);
      }
    );
  }

  async restoreData() {
    await this.manager.transaction(async (em) => {
      const foreignKeyManager = await this.foreignKeyManager(em);
      await foreignKeyManager.disable();

      await Promise.all(
        [...this.tables].map(async (tableName) => {
          await em.query(this.getQuery("truncateTable", { tableName }));
          await em.query(this.getQuery("restoreData", { tableName }));
        })
      );

      await foreignKeyManager.enable();
    });
  }

  async foreignKeyManager(em: EntityManager) {
    if (this.tables.size === 0) {
      await this.detectTables(em);
    }

    switch (this.type) {
      case "postgres":
        return {
          disable: async () => Promise.resolve({}),
          enable: async () => Promise.resolve({}),
        };
      default:
        return {
          disable: async () => em.query(this.getQuery("foreignKey.disable")),
          enable: async () => em.query(this.getQuery("foreignKey.enable")),
        };
    }
  }

  async clearTempTables() {
    this.tables.clear();
  }
}
