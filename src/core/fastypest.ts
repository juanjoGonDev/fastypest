import { performance } from "node:perf_hooks";
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
import { configureLogging, createScopedLogger } from "../logging";
import type { LoggingOptions, ScopedLogger } from "../logging";

const LOG_SCOPE_FASTYPEST = "Fastypest";
const LOG_TEXT = {
  loggingEnabled: "🟢 Logging enabled",
  loggingDisabled: "⚪️ Logging disabled",
  changeTrackingEnabled: "🛰️ Change detection strategy enabled",
  subscriberRegistered: "📡 Change tracking subscriber registered",
  initializationStarted: "🚀 Initialization started",
  initializationCompleted: "✅ Initialization completed",
  tablesDiscovered: "🗂️ Tables discovered",
  dependenciesReady: "🧭 Dependency order calculated",
  tempTablesPrepared: "🧪 Temporary tables prepared",
  autoIncrementAnalyzed: "📊 Auto increment analysis completed",
  autoIncrementColumn: "🔁 Auto increment column processed",
  restoreStarted: "🛠️ Restore process started",
  restoreMode: "🧱 Restore mode selected",
  restoringTable: "📥 Restoring table",
  tableRestored: "✅ Table restored",
  tableTruncated: "🧹 Table truncated",
  dataRestored: "📦 Table data restored",
  foreignKeyDisabled: "🚧 Foreign keys disabled",
  foreignKeyEnabled: "🆗 Foreign keys enabled",
  restoreCompleted: "🎉 Restore process completed",
  autoIncrementReset: "♻️ Auto increment column reset",
  changeDetected: "🔎 Table change detected",
  noChanges: "🕊️ No tracked changes detected",
  filteredTables: "🗜️ Filtered tables by detected changes",
} as const;

const METADATA_KEYS = {
  databaseType: "databaseType",
  loggingEnabled: "loggingEnabled",
  loggingLevel: "loggingLevel",
  changeDetectionStrategy: "changeDetectionStrategy",
  durationSeconds: "durationInSeconds",
  totalTables: "totalTables",
  table: "table",
  progressCurrent: "current",
  progressTotal: "total",
  mode: "mode",
  sequences: "sequences",
  columns: "columns",
  tablesWithAutoIncrement: "tablesWithAutoIncrement",
  changedTables: "changedTables",
  tablesRestored: "tablesRestored",
} as const;

const RESTORE_MODE_ORDERED = "ordered";
const RESTORE_MODE_PARALLEL = "parallel";

const MILLISECONDS_IN_SECOND = 1000;
const DURATION_PRECISION = 2;
const PROGRESS_OFFSET = 1;

export class Fastypest extends SQLScript {
  private manager: EntityManager;
  private tables: Set<string> = new Set();
  private tablesWithAutoIncrement: Map<string, IncrementDetail[]> = new Map();
  private restoreInOder: boolean = false;
  private readonly options: Required<Omit<FastypestOptions, "logging">>;
  private readonly changedTables: Set<string> = new Set();
  private readonly logger: ScopedLogger;

  constructor(
    connection: DataSource | Connection,
    options?: FastypestOptions
  ) {
    super(connection.options.type);
    const loggingConfiguration = this.resolveLoggingConfiguration(options?.logging);
    const resolvedLogging = configureLogging(loggingConfiguration);
    this.logger = createScopedLogger(LOG_SCOPE_FASTYPEST);
    this.manager = connection.manager;
    this.options = {
      changeDetectionStrategy:
        options?.changeDetectionStrategy ?? ChangeDetectionStrategy.None,
    };
    this.logger.info(
      resolvedLogging.enabled ? LOG_TEXT.loggingEnabled : LOG_TEXT.loggingDisabled,
      {
        [METADATA_KEYS.loggingEnabled]: resolvedLogging.enabled,
        [METADATA_KEYS.loggingLevel]: resolvedLogging.level,
        [METADATA_KEYS.databaseType]: this.getType(),
        [METADATA_KEYS.changeDetectionStrategy]: this.options.changeDetectionStrategy,
      }
    );
    if (
      this.options.changeDetectionStrategy ===
      ChangeDetectionStrategy.Subscriber
    ) {
      this.logger.info(LOG_TEXT.changeTrackingEnabled);
      this.registerSubscriber(connection);
    }
  }

  public async init(): Promise<void> {
    const startTime = performance.now();
    this.logger.info(LOG_TEXT.initializationStarted, {
      [METADATA_KEYS.databaseType]: this.getType(),
    });
    await this.manager.transaction(async (em: EntityManager) => {
      await this.detectTables(em);
      await this.calculateDependencyTables(em);
      const tables = [...this.tables];
      await Promise.all([
        this.createTempTable(em, tables),
        this.detectTablesWithAutoIncrement(em, tables),
      ]);
    });
    this.logger.info(LOG_TEXT.initializationCompleted, {
      [METADATA_KEYS.durationSeconds]: this.formatDuration(
        performance.now() - startTime
      ),
      [METADATA_KEYS.totalTables]: this.tables.size,
      [METADATA_KEYS.tablesWithAutoIncrement]:
        this.tablesWithAutoIncrement.size,
    });
  }

  private async createTempTable(
    em: EntityManager,
    tables: string[]
  ): Promise<void> {
    const totalTables = tables.length;
    await Promise.all(
      tables.map(async (tableName, index) => {
        await this.execQuery(em, "dropTempTable", { tableName });
        await this.execQuery(em, "createTempTable", { tableName });
        this.logger.debug(LOG_TEXT.tempTablesPrepared, {
          [METADATA_KEYS.table]: tableName,
          [METADATA_KEYS.progressCurrent]: index + PROGRESS_OFFSET,
          [METADATA_KEYS.progressTotal]: totalTables,
        });
      })
    );
  }

  private async detectTablesWithAutoIncrement(
    em: EntityManager,
    tables: string[]
  ): Promise<void> {
    const totalTables = tables.length;
    for (const [index, tableName] of tables.entries()) {
      await this.processTable(em, tableName, index + PROGRESS_OFFSET, totalTables);
    }
    this.logger.debug(LOG_TEXT.autoIncrementAnalyzed, {
      [METADATA_KEYS.tablesWithAutoIncrement]: this.tablesWithAutoIncrement.size,
    });
  }

  private async processTable(
    em: EntityManager,
    tableName: string,
    position: number,
    total: number
  ): Promise<void> {
    const columns = await this.getColumnsWithAutoIncrement(em, tableName);
    if (!columns) return;

    for (const column of columns) {
      await this.processColumn(em, tableName, column, position, total);
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
    column: ColumnsWithAutoIncrement,
    position: number,
    total: number
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
    this.logger.debug(LOG_TEXT.autoIncrementColumn, {
      [METADATA_KEYS.table]: tableName,
      [METADATA_KEYS.columns]: column.column_name,
      [METADATA_KEYS.sequences]: sequenceName,
      [METADATA_KEYS.progressCurrent]: position,
      [METADATA_KEYS.progressTotal]: total,
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
    const startTime = performance.now();
    const tablesToRestore = this.getTablesForRestore();
    if (this.shouldTrackChanges() && this.changedTables.size === 0) {
      this.logger.debug(LOG_TEXT.noChanges, {
        [METADATA_KEYS.totalTables]: tablesToRestore.length,
      });
    }
    this.logger.info(LOG_TEXT.restoreStarted, {
      [METADATA_KEYS.totalTables]: tablesToRestore.length,
      [METADATA_KEYS.changedTables]: this.shouldTrackChanges()
        ? this.changedTables.size
        : undefined,
    });
    await this.manager.transaction(async (em: EntityManager) => {
      const { foreignKey, restoreOrder } = await this.restoreManager(em);
      await foreignKey.disable();
      await restoreOrder();
      await foreignKey.enable();
    });
    this.logger.info(LOG_TEXT.restoreCompleted, {
      [METADATA_KEYS.durationSeconds]: this.formatDuration(
        performance.now() - startTime
      ),
      [METADATA_KEYS.tablesRestored]: tablesToRestore.length,
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
      manager.foreignKey.disable = async (): Promise<void> => {
        this.logger.debug(LOG_TEXT.foreignKeyDisabled, {
          [METADATA_KEYS.databaseType]: this.getType(),
        });
        await this.execQuery(em, "foreignKey.disable");
      };
      manager.foreignKey.enable = async (): Promise<void> => {
        await this.execQuery(em, "foreignKey.enable");
        this.logger.debug(LOG_TEXT.foreignKeyEnabled, {
          [METADATA_KEYS.databaseType]: this.getType(),
        });
      };
    }

    manager.restoreOrder = (): Promise<void> => this.restoreOrder(em);

    return manager;
  }

  private async calculateDependencyTables(em: EntityManager): Promise<void> {
    const startTime = performance.now();
    const dependencyTree = await this.execQuery<DependencyTreeQueryOut>(
      em,
      "dependencyTree"
    );

    if (!dependencyTree.length) {
      this.restoreInOder = false;
      this.logger.debug(LOG_TEXT.dependenciesReady, {
        [METADATA_KEYS.mode]: RESTORE_MODE_PARALLEL,
        [METADATA_KEYS.durationSeconds]: this.formatDuration(
          performance.now() - startTime
        ),
        [METADATA_KEYS.totalTables]: this.tables.size,
      });
      return;
    }

    const sortedTables = new Set(dependencyTree.map((row) => row.table_name));
    this.tables.clear();
    this.tables = sortedTables;
    this.restoreInOder = true;
    this.logger.debug(LOG_TEXT.dependenciesReady, {
      [METADATA_KEYS.mode]: RESTORE_MODE_ORDERED,
      [METADATA_KEYS.durationSeconds]: this.formatDuration(
        performance.now() - startTime
      ),
      [METADATA_KEYS.totalTables]: this.tables.size,
    });
  }

  private async detectTables(em: EntityManager): Promise<void> {
    const startTime = performance.now();
    const tables = await this.execQuery<Table>(em, "getTables");
    if (!tables) {
      this.logger.debug(LOG_TEXT.tablesDiscovered, {
        [METADATA_KEYS.totalTables]: this.tables.size,
        [METADATA_KEYS.durationSeconds]: this.formatDuration(
          performance.now() - startTime
        ),
      });
      return;
    }

    tables.forEach((row) => {
      this.tables.add(row.name);
    });
    this.logger.debug(LOG_TEXT.tablesDiscovered, {
      [METADATA_KEYS.totalTables]: this.tables.size,
      [METADATA_KEYS.durationSeconds]: this.formatDuration(
        performance.now() - startTime
      ),
    });
  }

  private async restoreOrder(em: EntityManager): Promise<void> {
    const tables = this.getTablesForRestore();
    const totalTables = tables.length;
    if (this.restoreInOder) {
      this.logger.debug(LOG_TEXT.restoreMode, {
        [METADATA_KEYS.mode]: RESTORE_MODE_ORDERED,
        [METADATA_KEYS.totalTables]: totalTables,
      });
      for (const [index, tableName] of tables.entries()) {
        await this.recreateData(
          em,
          tableName,
          index + PROGRESS_OFFSET,
          totalTables
        );
      }
    } else {
      this.logger.debug(LOG_TEXT.restoreMode, {
        [METADATA_KEYS.mode]: RESTORE_MODE_PARALLEL,
        [METADATA_KEYS.totalTables]: totalTables,
      });
      await Promise.all(
        tables.map((tableName, index) =>
          this.recreateData(
            em,
            tableName,
            index + PROGRESS_OFFSET,
            totalTables
          )
        )
      );
    }
    if (this.shouldTrackChanges()) {
      this.changedTables.clear();
    }
  }

  private async recreateData(
    em: EntityManager,
    tableName: string,
    position: number,
    total: number
  ): Promise<void> {
    const startTime = performance.now();
    this.logger.info(LOG_TEXT.restoringTable, {
      [METADATA_KEYS.table]: tableName,
      [METADATA_KEYS.progressCurrent]: position,
      [METADATA_KEYS.progressTotal]: total,
    });
    await this.execQuery(em, "truncateTable", { tableName });
    this.logger.debug(LOG_TEXT.tableTruncated, {
      [METADATA_KEYS.table]: tableName,
      [METADATA_KEYS.progressCurrent]: position,
      [METADATA_KEYS.progressTotal]: total,
    });
    await this.execQuery(em, "restoreData", { tableName });
    this.logger.debug(LOG_TEXT.dataRestored, {
      [METADATA_KEYS.table]: tableName,
      [METADATA_KEYS.progressCurrent]: position,
      [METADATA_KEYS.progressTotal]: total,
    });
    await this.resetAutoIncrementColumns(em, tableName);
    this.logger.info(LOG_TEXT.tableRestored, {
      [METADATA_KEYS.table]: tableName,
      [METADATA_KEYS.durationSeconds]: this.formatDuration(
        performance.now() - startTime
      ),
      [METADATA_KEYS.progressCurrent]: position,
      [METADATA_KEYS.progressTotal]: total,
    });
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
      this.logger.debug(LOG_TEXT.autoIncrementReset, {
        [METADATA_KEYS.table]: tableName,
        [METADATA_KEYS.columns]: column,
        [METADATA_KEYS.sequences]: sequenceName,
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
    this.logger.info(LOG_TEXT.subscriberRegistered, {
      [METADATA_KEYS.databaseType]: this.getType(),
    });
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
    this.logger.debug(LOG_TEXT.filteredTables, {
      [METADATA_KEYS.changedTables]: filtered.length,
      [METADATA_KEYS.totalTables]: tables.length,
    });
    return filtered;
  }

  public markTableAsChanged(tableName: string): void {
    if (!this.shouldTrackChanges()) {
      return;
    }
    const wasTracked = this.changedTables.has(tableName);
    this.changedTables.add(tableName);
    if (!wasTracked) {
      this.logger.debug(LOG_TEXT.changeDetected, {
        [METADATA_KEYS.table]: tableName,
        [METADATA_KEYS.changedTables]: this.changedTables.size,
      });
    }
  }

  private resolveLoggingConfiguration(
    logging?: boolean | LoggingOptions
  ): LoggingOptions | undefined {
    if (typeof logging === "boolean") {
      return { enabled: logging };
    }
    if (!logging) {
      return undefined;
    }
    if (logging.enabled === undefined) {
      return { ...logging, enabled: true };
    }
    return logging;
  }

  private formatDuration(milliseconds: number): number {
    const seconds = milliseconds / MILLISECONDS_IN_SECOND;
    return Number(seconds.toFixed(DURATION_PRECISION));
  }
}

type SubscriberLifecycle = {
  setDataSource?: (dataSource: DataSource) => unknown;
  setConnection?: (connection: Connection) => unknown;
};
