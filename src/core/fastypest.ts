import {
  Connection,
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  Table,
} from "typeorm";
import { INDEX_OFFSET_CONFIG } from "./config";
import { SQLScript } from "./sql-script";
import { ChangeTrackerSubscriber } from "./subscribers/change-tracker.subscriber";
import {
  ChangeDetectionStrategy,
  type ColumnStat,
  type ColumnsWithAutoIncrement,
  type DBType,
  type DependencyTreeQueryOut,
  type FastypestOptions,
  type IncrementDetail,
  type Manager,
} from "./types";

export class Fastypest extends SQLScript {
  private manager: EntityManager;
  private tables: Set<string> = new Set();
  private tablesWithAutoIncrement: Map<string, IncrementDetail[]> = new Map();
  private restoreInOder: boolean = false;
  private readonly options: Required<FastypestOptions>;
  private readonly changedTables: Set<string> = new Set();

  constructor(
    connection: DataSource | Connection,
    options?: FastypestOptions
  ) {
    super(connection.options.type);
    this.manager = connection.manager;
    this.options = {
      changeDetectionStrategy:
        options?.changeDetectionStrategy ?? ChangeDetectionStrategy.None,
    };
    if (
      this.options.changeDetectionStrategy ===
      ChangeDetectionStrategy.Subscriber
    ) {
      this.registerSubscriber(connection);
    }
  }

  public async init(): Promise<void> {
    await this.manager.transaction(async (em: EntityManager) => {
      await this.detectTables(em);
      await this.calculateDependencyTables(em);
      const tables = [...this.tables];
      await Promise.all([
        this.createTempTable(em, tables),
        this.detectTablesWithAutoIncrement(em, tables),
      ]);
    });
  }

  private async createTempTable(
    em: EntityManager,
    tables: string[]
  ): Promise<void> {
    await Promise.all(
      tables.map(async (tableName) => {
        await this.execQuery(em, "createTempTable", { tableName });
      })
    );
  }

  private async detectTablesWithAutoIncrement(
    em: EntityManager,
    tables: string[]
  ): Promise<void> {
    for (const tableName of tables) {
      await this.processTable(em, tableName);
    }
  }

  private async processTable(
    em: EntityManager,
    tableName: string
  ): Promise<void> {
    const columns = await this.getColumnsWithAutoIncrement(em, tableName);
    if (!columns) return;

    for (const column of columns) {
      await this.processColumn(em, tableName, column);
    }
  }

  private async getColumnsWithAutoIncrement(
    em: EntityManager,
    tableName: string
  ): Promise<ColumnsWithAutoIncrement[] | null> {
    const columns = await this.execQuery<ColumnsWithAutoIncrement>(
      em,
      "getColumnsWithAutoIncrement",
      { tableName }
    );
    return Array.isArray(columns) ? columns : null;
  }

  private async processColumn(
    em: EntityManager,
    tableName: string,
    column: ColumnsWithAutoIncrement
  ): Promise<void> {
    const stat = await this.getMaxColumnIndex(
      em,
      tableName,
      column.column_name
    );
    const sequenceName = this.getSequenceName(column.column_default);
    if (!sequenceName) return;

    const index = Number(stat?.maxindex) || 0;
    this.updateTablesWithAutoIncrement(tableName, {
      column: column.column_name,
      sequenceName,
      index: String(index + (INDEX_OFFSET_CONFIG[this.getType()] ?? 0)),
    });
  }

  private async getMaxColumnIndex(
    em: EntityManager,
    tableName: string,
    columnName: string
  ): Promise<ColumnStat | null> {
    const [stat] = await this.execQuery<ColumnStat>(em, "getMaxColumnIndex", {
      tableName,
      column_name: columnName,
    });
    return stat || null;
  }

  private getSequenceName(columnDefault: string): string | null {
    return columnDefault.match(/'([^']+)'/)?.[1] || null;
  }

  private updateTablesWithAutoIncrement(
    tableName: string,
    data: { column: string; sequenceName: string; index: string }
  ): void {
    if (!this.tablesWithAutoIncrement.has(tableName)) {
      this.tablesWithAutoIncrement.set(tableName, []);
    }

    this.tablesWithAutoIncrement.get(tableName)?.push(data);
  }

  public async restoreData(): Promise<void> {
    await this.manager.transaction(async (em: EntityManager) => {
      const { foreignKey, restoreOrder } = await this.restoreManager(em);
      await foreignKey.disable();
      await restoreOrder();
      await foreignKey.enable();
    });
  }

  protected async restoreManager(em: EntityManager): Promise<Manager> {
    if (this.tables.size === 0) {
      await this.detectTables(em);
    }

    const manager: Manager = {
      foreignKey: {
        disable: async () => Promise.resolve(),
        enable: async () => Promise.resolve(),
      },
      restoreOrder: async () => Promise.resolve(),
    };

    const typesWithForeignKey: DBType[] = ["postgres", "mariadb", "mysql"];
    if (typesWithForeignKey.includes(this.getType())) {
      manager.foreignKey.disable = async (): Promise<void> =>
        this.execQuery(em, "foreignKey.disable");
      manager.foreignKey.enable = async (): Promise<void> =>
        this.execQuery(em, "foreignKey.enable");
    }

    manager.restoreOrder = (): Promise<void> => this.restoreOrder(em);

    return manager;
  }

  private async calculateDependencyTables(em: EntityManager): Promise<void> {
    const dependencyTree = await this.execQuery<DependencyTreeQueryOut>(
      em,
      "dependencyTree"
    );

    if (!dependencyTree.length) {
      this.restoreInOder = false;
      return;
    }

    const sortedTables = new Set(dependencyTree.map((row) => row.table_name));
    this.tables.clear();
    this.tables = sortedTables;
    this.restoreInOder = true;
  }

  private async detectTables(em: EntityManager): Promise<void> {
    const tables = await this.execQuery<Table>(em, "getTables");
    if (!tables) return;

    tables.forEach((row) => {
      this.tables.add(row.name);
    });
  }

  private async restoreOrder(em: EntityManager): Promise<void> {
    const tables = this.getTablesForRestore();
    if (this.restoreInOder) {
      for (const tableName of tables) {
        await this.recreateData(em, tableName);
      }
    } else {
      await Promise.all(
        tables.map((tableName) => this.recreateData(em, tableName))
      );
    }
    if (this.shouldTrackChanges()) {
      this.changedTables.clear();
    }
  }

  private async recreateData(
    em: EntityManager,
    tableName: string
  ): Promise<void> {
    await this.execQuery(em, "truncateTable", { tableName });
    await this.execQuery(em, "restoreData", { tableName });
    await this.resetAutoIncrementColumns(em, tableName);
  }

  private async resetAutoIncrementColumns(
    em: EntityManager,
    tableName: string
  ): Promise<void> {
    const tables = this.tablesWithAutoIncrement.get(tableName);
    if (!tables) return;

    for (const { column, sequenceName, index } of tables) {
      await this.execQuery(em, "resetAutoIncrementColumn", {
        tableName,
        column,
        sequenceName,
        index,
      });
    }
  }

  private registerSubscriber(connection: DataSource | Connection): void {
    const subscriber = new ChangeTrackerSubscriber((tableName) => {
      this.markTableAsChanged(tableName);
    });
    this.getSubscriberCollection(connection).push(subscriber);
    this.bindSubscriber(subscriber, connection);
  }

  private isDataSource(
    connection: DataSource | Connection
  ): connection is DataSource {
    return connection instanceof DataSource;
  }

  private getSubscriberCollection(
    connection: DataSource | Connection
  ): Array<EntitySubscriberInterface<unknown>> {
    return (connection as unknown as {
      subscribers: Array<EntitySubscriberInterface<unknown>>;
    }).subscribers;
  }

  private bindSubscriber(
    subscriber: ChangeTrackerSubscriber,
    connection: DataSource | Connection
  ): void {
    const lifecycle = subscriber as ChangeTrackerSubscriber & SubscriberLifecycle;
    if (this.isDataSource(connection)) {
      lifecycle.setDataSource?.(connection);
      return;
    }
    lifecycle.setConnection?.(connection);
  }

  private shouldTrackChanges(): boolean {
    return (
      this.options.changeDetectionStrategy ===
      ChangeDetectionStrategy.Subscriber
    );
  }

  private getTablesForRestore(): string[] {
    const tables = [...this.tables];
    if (!this.shouldTrackChanges()) {
      return tables;
    }
    if (this.changedTables.size === 0) {
      return tables;
    }
    const changed = new Set(this.changedTables);
    const filtered = tables.filter((table) => changed.has(table));
    if (filtered.length === 0) {
      return tables;
    }
    return filtered;
  }

  public markTableAsChanged(tableName: string): void {
    if (!this.shouldTrackChanges()) {
      return;
    }
    this.changedTables.add(tableName);
  }
}

type SubscriberLifecycle = {
  setDataSource?: (dataSource: DataSource) => unknown;
  setConnection?: (connection: Connection) => unknown;
};
