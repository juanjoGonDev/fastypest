import {
  Connection,
  DataSource,
  DataSourceOptions,
  EntityManager,
} from "typeorm";

export class TypeormTestBoost {
  private manager: EntityManager;
  private database: DataSourceOptions["database"];
  private type: DataSourceOptions["type"];
  private tables: Set<string> = new Set();

  constructor(connection: DataSource | Connection) {
    this.manager = connection.manager;
    this.database = connection.options.database;
    this.type = connection.options.type;
  }

  async init() {
    await this.manager.transaction(async (em) => {
      (await em.query(this.getTables())).map((row: Record<string, string>) =>
        this.tables.add(row.tableName)
      );

      await Promise.all(
        [...this.tables].map(async (tableName) =>
          em.query(this.getTemporaryTableQueries(tableName).createTempTable)
        )
      );
    });
  }

  async restoreData() {
    await this.manager.transaction(async (em) => {
      const foreignKeysManager = this.managerForeignKey();
      const hasForeignKeyQuery = foreignKeysManager !== null;
      if (hasForeignKeyQuery) {
        await em.query(foreignKeysManager?.disable);
      }

      await Promise.all(
        [...this.tables].map(async (tableName) => {
          const queries = this.getTemporaryTableQueries(tableName);
          await em.query(queries.truncateOriginalData);
          await em.query(queries.restoreOriginalData);
        })
      );

      if (hasForeignKeyQuery) {
        await em.query(foreignKeysManager?.enable);
      }
    });
  }

  async clearTempTables() {
    await this.manager.transaction(async (em) => {
      await Promise.all(
        [...this.tables].map(async (tableName) => {
          await em.query(
            this.getTemporaryTableQueries(tableName).dropTempTable
          );
        })
      );
    });

    this.tables.clear();
  }

  private managerForeignKey() {
    switch (this.type) {
      case "postgres":
      case "cockroachdb":
        return {
          disable: `SET CONSTRAINTS ALL DEFERRED`,
          enable: `SET CONSTRAINTS ALL IMMEDIATE`,
        };
      case "mariadb":
      case "mysql":
        return {
          disable: `SET FOREIGN_KEY_CHECKS=0`,
          enable: `SET FOREIGN_KEY_CHECKS=1`,
        };
      case "sqlite":
        return {
          disable: `PRAGMA foreign_keys=off`,
          enable: `PRAGMA foreign_keys=on`,
        };
      case "mssql":
        return {
          disable: `EXEC sp_msforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'`,
          enable: `EXEC sp_msforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL'`,
        };
      case "oracle":
        return {
          disable: `BEGIN
          FOR c IN (SELECT table_name FROM all_tables WHERE owner = '${this.database}') LOOP
            EXECUTE IMMEDIATE 'ALTER TABLE ' || c.table_name || ' DISABLE CONSTRAINT ALL';
          END LOOP;
        END;
        /`,
          enable: `BEGIN
        FOR c IN (SELECT table_name FROM all_tables WHERE owner = '${this.database}') LOOP
          EXECUTE IMMEDIATE 'ALTER TABLE ' || c.table_name || ' ENABLE CONSTRAINT ALL';
        END LOOP;
      END;
      /`,
        };
      default:
        return null;
    }
  }

  private getTables(): string {
    switch (this.type) {
      case "mysql":
      case "mariadb":
      case "mssql":
      case "cockroachdb":
        return `SELECT table_name as tableName 
                FROM information_schema.tables
                WHERE table_schema = '${this.database}'
                AND table_type = 'BASE TABLE';`;
      case "postgres":
        return `SELECT table_name as tableName 
                FROM information_schema.tables
                WHERE table_catalog = '${this.database}'
                AND table_type = 'BASE TABLE';`;
      case "sqlite":
        return `SELECT name as tableName 
                FROM sqlite_master
                WHERE type = 'table'
                AND name NOT LIKE 'sqlite_%';`;
      case "oracle":
        return `SELECT table_name as tableName 
                FROM all_tables
                WHERE owner = '${this.database}';`;
      default:
        throw new Error(`Unsupported database type: ${this.type}`);
    }
  }

  private getTemporaryTableQueries(tableName: string) {
    const tempName = `${tableName}_temporal_`;

    switch (this.type) {
      case "postgres":
      case "cockroachdb":
        return {
          createTempTable: `CREATE TEMPORARY TABLE ${tempName} ON COMMIT DROP AS SELECT * FROM ${tableName}`,
          dropTempTable: `DROP TABLE ${tempName}`,
          restoreOriginalData: `INSERT INTO ${tableName} SELECT * FROM ${tempName}`,
          truncateOriginalData: `TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`,
        };
      case "mariadb":
      case "mysql":
        return {
          createTempTable: `CREATE TEMPORARY TABLE ${tempName} AS SELECT * FROM ${tableName}`,
          dropTempTable: `DROP TEMPORARY TABLE ${tempName}`,
          restoreOriginalData: `INSERT INTO ${tableName} SELECT * FROM ${tempName}`,
          truncateOriginalData: `TRUNCATE TABLE ${tableName}`,
        };
      case "oracle":
        return {
          createTempTable: `CREATE GLOBAL TEMPORARY TABLE ${tempName} (LIKE ${tableName} INCLUDING CONSTRAINTS) ON COMMIT DELETE ROWS`,
          dropTempTable: `DROP TABLE ${tempName} PURGE`,
          restoreOriginalData: `INSERT INTO ${tableName} SELECT * FROM ${tempName}`,
          truncateOriginalData: `TRUNCATE TABLE ${tableName}`,
        };
      case "mssql":
        return {
          createTempTable: `SELECT * INTO #${tempName} FROM ${tableName}`,
          dropTempTable: `DROP TABLE #${tempName}`,
          restoreOriginalData: `INSERT INTO ${tableName} SELECT * FROM ${tempName}`,
          truncateOriginalData: `TRUNCATE TABLE ${tableName}`,
        };
      case "sqlite":
        return {
          createTempTable: `CREATE TEMPORARY TABLE ${tempName} AS SELECT * FROM ${tableName}`,
          dropTempTable: `DROP TABLE ${tempName}`,
          restoreOriginalData: `INSERT INTO ${tableName} SELECT * FROM ${tempName}`,
          truncateOriginalData: `DELETE FROM ${tableName}`,
        };
      default:
        throw new Error(
          `Database type "${this.type}" is not supported for temporary tables`
        );
    }
  }
}
