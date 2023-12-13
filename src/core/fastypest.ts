import { Connection, DataSource, EntityManager } from "typeorm";
import { SQLScript } from "./sql-script";

interface Manager {
  foreignKey: {
    disable: () => Promise<string | object>;
    enable: () => Promise<string | object>;
  };
  dependencyTree: () => Promise<Set<string> | undefined>;
}

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
      const restoreManager = await this.restoreManager(em);
      await restoreManager.foreignKey.disable();
      const dependencyTree = await restoreManager.dependencyTree();
      const tables = [...(dependencyTree || this.tables)];

      await this.restoreOrder(em, tables, dependencyTree ? "sorted" : "random");

      await restoreManager.foreignKey.enable();
    });
  }

  private async restoreOrder(
    em: EntityManager,
    tables: string[],
    type: "sorted" | "random" = "random"
  ) {
    switch (type) {
      case "sorted":
        for (const tableName of tables) {
          await em.query(this.getQuery("truncateTable", { tableName }));
          await em.query(this.getQuery("restoreData", { tableName }));
        }
        break;
      default:
        await Promise.all(
          tables.map(async (tableName) => {
            await em.query(this.getQuery("truncateTable", { tableName }));
            await em.query(this.getQuery("restoreData", { tableName }));
          })
        );
        break;
    }
  }

  async restoreManager(em: EntityManager) {
    if (this.tables.size === 0) {
      await this.detectTables(em);
    }

    const manager: Manager = {
      foreignKey: {
        disable: async () => Promise.resolve({}),
        enable: async () => Promise.resolve({}),
      },
      dependencyTree: async () => Promise.resolve(undefined),
    };

    switch (this.type) {
      case "cockroachdb":
        const dependencyTree = await em.query(this.getQuery("dependencyTree"));
        manager.dependencyTree = async () =>
          new Set(
            dependencyTree.map((row: Record<string, string>) => row.table_name)
          ) as Set<string>;
        break;
      case "mariadb":
      case "mysql":
        manager.foreignKey.disable = async () =>
          em.query(this.getQuery("foreignKey.disable"));
        manager.foreignKey.enable = async () =>
          em.query(this.getQuery("foreignKey.enable"));
    }

    return manager;
  }

  async clearTempTables() {
    this.tables.clear();
  }
}
