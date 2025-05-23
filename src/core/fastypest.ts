import { Connection, DataSource, EntityManager, Table } from "typeorm";
import { SQLQueryManager } from "./sql-query-manager";
import { AutoIncrementManager } from "./auto-increment-manager";
import { SQLScript } from "./sql-script";
import { INDEX_OFFSET_CONFIG } from "./config"; // Import the configuration
import type {
  DBType,
  DependencyTreeQueryOut,
  Manager,
} from "./types";

export class Fastypest extends SQLScript {
  private manager: EntityManager;
  private tables: Set<string> = new Set();
  private restoreInOder: boolean = false;
  private queryManager: SQLQueryManager;
  private autoIncrementManager: AutoIncrementManager;
  private dbType: DBType;

  constructor(connection: DataSource | Connection) {
    const dbType = connection.options.type as DBType;
    super(dbType);
    this.dbType = dbType;
    this.manager = connection.manager;
    this.queryManager = new SQLQueryManager(this.dbType, this.manager, this);
    // Pass INDEX_OFFSET_CONFIG to AutoIncrementManager constructor
    this.autoIncrementManager = new AutoIncrementManager(
      this.dbType,
      this.queryManager,
      this.manager,
      INDEX_OFFSET_CONFIG // Pass the imported config
    );
  }

  public async init(): Promise<void> {
    await this.manager.transaction(async (em: EntityManager) => {
      // Pass EntityManager 'em' to methods that need it
      await this.detectAllTables(em);
      await this.calculateAllTableDependencies(em);
      await this.createAllTempTables(em);
      await this.detectAllTablesWithAutoIncrement(em);
    });
    console.log('Fastypest initialized successfully.');
  }

  private async detectAllTables(em: EntityManager): Promise<void> {
    const tablesData = await this.queryManager.execQuery<Table>(em, "getTables"); // Returns Table[] | undefined
    if (!tablesData) return; // Handles undefined
    // tablesData is now guaranteed to be Table[]
    tablesData.forEach((row: Table) => { // Added type for row
      this.tables.add(row.name);
    });
  }

  private async calculateAllTableDependencies(em: EntityManager): Promise<void> {
    const dependencyTree = await this.queryManager.execQuery<DependencyTreeQueryOut>( // Returns DependencyTreeQueryOut[] | undefined
      em,
      "dependencyTree"
    );

    if (!dependencyTree || dependencyTree.length === 0) { // Handles undefined and empty array
      this.restoreInOder = false;
      return;
    }
    // dependencyTree is now guaranteed to be DependencyTreeQueryOut[] with length > 0
    const sortedTableNames = new Set(dependencyTree.map((row: DependencyTreeQueryOut) => row.table_name)); // Added type for row
    this.tables.clear();
    this.tables = sortedTableNames; // sortedTableNames is Set<string>
    this.restoreInOder = true;
  }

  private async createAllTempTables(em: EntityManager): Promise<void> {
    const tables = [...this.tables];
    await Promise.all(
      tables.map(async (tableName) => {
        // Ensure execQuery in SQLQueryManager can handle EntityManager if required
        await this.queryManager.execQuery(em, "createTempTable", { tableName });
      })
    );
  }

  private async detectAllTablesWithAutoIncrement(em: EntityManager): Promise<void> {
    const tables = [...this.tables];
    // Pass EntityManager 'em' to AutoIncrementManager methods
    await this.autoIncrementManager.detectTablesWithAutoIncrement(em, tables);
  }


  public async restoreData(): Promise<void> {
    await this.manager.transaction(async (em: EntityManager) => {
      const { foreignKey, restoreOrder } = await this.createRestoreManager(em);
      await foreignKey.disable();
      await restoreOrder(); // This now correctly calls the instance method
      await foreignKey.enable();
    });
  }

  // Renamed from restoreManager to avoid conflict with TypeORM's manager property
  protected async createRestoreManager(em: EntityManager): Promise<Manager> {
    if (this.tables.size === 0) {
      await this.detectAllTables(em); // Use the refactored method
    }

    const managerSetup: Manager = {
      foreignKey: {
        disable: async () => Promise.resolve(),
        enable: async () => Promise.resolve(),
      },
      restoreOrder: async () => Promise.resolve(),
    };

    const typesWithForeignKey: DBType[] = ["postgres", "mariadb", "mysql"];
    if (typesWithForeignKey.includes(this.dbType)) { // Use this.dbType
      managerSetup.foreignKey.disable = async (): Promise<void> => {
        await this.queryManager.execQuery(em, "foreignKey.disable");
      };
      managerSetup.foreignKey.enable = async (): Promise<void> => {
        await this.queryManager.execQuery(em, "foreignKey.enable");
      };
    }

    managerSetup.restoreOrder = (): Promise<void> => this.executeRestoreOrder(em); // Renamed to avoid confusion

    return managerSetup;
  }

  // Renamed from restoreOrder to executeRestoreOrder
  private async executeRestoreOrder(em: EntityManager): Promise<void> {
    const tablesToRestore = [...this.tables];
    if (this.restoreInOder) {
      for (const tableName of tablesToRestore) {
        await this.recreateSingleTableData(em, tableName);
      }
    } else {
      await Promise.all(
        tablesToRestore.map((tableName) => this.recreateSingleTableData(em, tableName))
      );
    }
  }

  private async recreateSingleTableData(
    em: EntityManager,
    tableName: string
  ): Promise<void> {
    await this.queryManager.execQuery(em, "truncateTable", { tableName });
    await this.queryManager.execQuery(em, "restoreData", { tableName });
    // Pass EntityManager 'em' to AutoIncrementManager method
    await this.autoIncrementManager.resetAutoIncrementColumns(em, tableName);
  }

  // Getter methods for private properties, primarily for testing or external read-only access.
  public getTables(): Set<string> {
    return this.tables;
  }

  public getTablesWithAutoIncrement() {
    return this.autoIncrementManager.getTablesWithAutoIncrement();
  }

  public getRestoreInOrder(): boolean {
    return this.restoreInOder;
  }

  // Expose SQLScript's execQuery to SQLQueryManager via the Fastypest instance
  public async executeQueryFromSqlScript<T = any>(
    em: EntityManager,
    queryPath: string, 
    values?: Record<string, string>
  ): Promise<T[]> { 
    // Cast to Promise<T[]> to align with the declared return type,
    // assuming that T will not be 'void' in the contexts this method is used.
    // SQLScript's execQuery has a conditional return type (T extends void ? Promise<void> : Promise<T[]>).
    return await super.execQuery<T>(em, queryPath as any, values) as Promise<T[]>;
  }
}
