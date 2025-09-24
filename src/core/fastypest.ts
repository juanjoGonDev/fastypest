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
const LOG_MESSAGE_LOGGING_ENABLED = "Logging enabled";
const LOG_MESSAGE_LOGGING_DISABLED = "Logging disabled";
const LOG_MESSAGE_CHANGE_TRACKING_ENABLED = "Change detection strategy enabled";
const LOG_MESSAGE_SUBSCRIBER_REGISTERED = "Change tracking subscriber registered";
const LOG_MESSAGE_INITIALIZATION_STARTED = "Initialization started";
const LOG_MESSAGE_INITIALIZATION_COMPLETED = "Initialization completed";
const LOG_MESSAGE_TABLES_DISCOVERED = "Tables discovered";
const LOG_MESSAGE_DEPENDENCIES_READY = "Dependency order calculated";
const LOG_MESSAGE_TEMP_TABLES_PREPARED = "Temporary tables prepared";
const LOG_MESSAGE_AUTO_INCREMENT_ANALYZED = "Auto increment analysis completed";
const LOG_MESSAGE_AUTO_INCREMENT_COLUMN = "Auto increment column processed";
const LOG_MESSAGE_RESTORE_STARTED = "Restore process started";
const LOG_MESSAGE_RESTORE_MODE = "Restore mode selected";
const LOG_MESSAGE_RESTORING_TABLE = "Restoring table";
const LOG_MESSAGE_TABLE_RESTORED = "Table restored";
const LOG_MESSAGE_TABLE_TRUNCATED = "Table truncated";
const LOG_MESSAGE_DATA_RESTORED = "Table data restored";
const LOG_MESSAGE_FOREIGN_KEY_DISABLED = "Foreign keys disabled";
const LOG_MESSAGE_FOREIGN_KEY_ENABLED = "Foreign keys enabled";
const LOG_MESSAGE_RESTORE_COMPLETED = "Restore process completed";
const LOG_MESSAGE_AUTO_INCREMENT_RESET = "Auto increment column reset";
const LOG_MESSAGE_CHANGE_DETECTED = "Table change detected";
const LOG_MESSAGE_NO_CHANGES = "No tracked changes detected";
const LOG_MESSAGE_FILTERED_TABLES = "Filtered tables by detected changes";

const METADATA_KEY_DATABASE_TYPE = "databaseType";
const METADATA_KEY_LOGGING_ENABLED = "loggingEnabled";
const METADATA_KEY_LOGGING_LEVEL = "loggingLevel";
const METADATA_KEY_CHANGE_STRATEGY = "changeDetectionStrategy";
const METADATA_KEY_DURATION_SECONDS = "durationInSeconds";
const METADATA_KEY_TOTAL_TABLES = "totalTables";
const METADATA_KEY_TABLE = "table";
const METADATA_KEY_PROGRESS_CURRENT = "current";
const METADATA_KEY_PROGRESS_TOTAL = "total";
const METADATA_KEY_MODE = "mode";
const METADATA_KEY_SEQUENCES = "sequences";
const METADATA_KEY_COLUMNS = "columns";
const METADATA_KEY_TABLES_WITH_AUTO_INCREMENT = "tablesWithAutoIncrement";
const METADATA_KEY_CHANGED_TABLES = "changedTables";
const METADATA_KEY_TABLES_RESTORED = "tablesRestored";

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
      resolvedLogging.enabled
        ? LOG_MESSAGE_LOGGING_ENABLED
        : LOG_MESSAGE_LOGGING_DISABLED,
      {
        [METADATA_KEY_LOGGING_ENABLED]: resolvedLogging.enabled,
        [METADATA_KEY_LOGGING_LEVEL]: resolvedLogging.level,
        [METADATA_KEY_DATABASE_TYPE]: this.getType(),
        [METADATA_KEY_CHANGE_STRATEGY]: this.options.changeDetectionStrategy,
      }
    );
    if (
      this.options.changeDetectionStrategy ===
      ChangeDetectionStrategy.Subscriber
    ) {
      this.logger.info(LOG_MESSAGE_CHANGE_TRACKING_ENABLED);
      this.registerSubscriber(connection);
    }
  }

  public async init(): Promise<void> {
    const startTime = performance.now();
    this.logger.info(LOG_MESSAGE_INITIALIZATION_STARTED, {
      [METADATA_KEY_DATABASE_TYPE]: this.getType(),
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
    this.logger.info(LOG_MESSAGE_INITIALIZATION_COMPLETED, {
      [METADATA_KEY_DURATION_SECONDS]: this.formatDuration(
        performance.now() - startTime
      ),
      [METADATA_KEY_TOTAL_TABLES]: this.tables.size,
      [METADATA_KEY_TABLES_WITH_AUTO_INCREMENT]:
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
        this.logger.debug(LOG_MESSAGE_TEMP_TABLES_PREPARED, {
          [METADATA_KEY_TABLE]: tableName,
          [METADATA_KEY_PROGRESS_CURRENT]: index + PROGRESS_OFFSET,
          [METADATA_KEY_PROGRESS_TOTAL]: totalTables,
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
    this.logger.debug(LOG_MESSAGE_AUTO_INCREMENT_ANALYZED, {
      [METADATA_KEY_TABLES_WITH_AUTO_INCREMENT]: this.tablesWithAutoIncrement.size,
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
    this.logger.debug(LOG_MESSAGE_AUTO_INCREMENT_COLUMN, {
      [METADATA_KEY_TABLE]: tableName,
      [METADATA_KEY_COLUMNS]: column.column_name,
      [METADATA_KEY_SEQUENCES]: sequenceName,
      [METADATA_KEY_PROGRESS_CURRENT]: position,
      [METADATA_KEY_PROGRESS_TOTAL]: total,
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
      this.logger.debug(LOG_MESSAGE_NO_CHANGES, {
        [METADATA_KEY_TOTAL_TABLES]: tablesToRestore.length,
      });
    }
    this.logger.info(LOG_MESSAGE_RESTORE_STARTED, {
      [METADATA_KEY_TOTAL_TABLES]: tablesToRestore.length,
      [METADATA_KEY_CHANGED_TABLES]: this.shouldTrackChanges()
        ? this.changedTables.size
        : undefined,
    });
    await this.manager.transaction(async (em: EntityManager) => {
      const { foreignKey, restoreOrder } = await this.restoreManager(em);
      await foreignKey.disable();
      await restoreOrder();
      await foreignKey.enable();
    });
    this.logger.info(LOG_MESSAGE_RESTORE_COMPLETED, {
      [METADATA_KEY_DURATION_SECONDS]: this.formatDuration(
        performance.now() - startTime
      ),
      [METADATA_KEY_TABLES_RESTORED]: tablesToRestore.length,
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
        this.logger.debug(LOG_MESSAGE_FOREIGN_KEY_DISABLED, {
          [METADATA_KEY_DATABASE_TYPE]: this.getType(),
        });
        await this.execQuery(em, "foreignKey.disable");
      };
      manager.foreignKey.enable = async (): Promise<void> => {
        await this.execQuery(em, "foreignKey.enable");
        this.logger.debug(LOG_MESSAGE_FOREIGN_KEY_ENABLED, {
          [METADATA_KEY_DATABASE_TYPE]: this.getType(),
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
      this.logger.debug(LOG_MESSAGE_DEPENDENCIES_READY, {
        [METADATA_KEY_MODE]: RESTORE_MODE_PARALLEL,
        [METADATA_KEY_DURATION_SECONDS]: this.formatDuration(
          performance.now() - startTime
        ),
        [METADATA_KEY_TOTAL_TABLES]: this.tables.size,
      });
      return;
    }

    const sortedTables = new Set(dependencyTree.map((row) => row.table_name));
    this.tables.clear();
    this.tables = sortedTables;
    this.restoreInOder = true;
    this.logger.debug(LOG_MESSAGE_DEPENDENCIES_READY, {
      [METADATA_KEY_MODE]: RESTORE_MODE_ORDERED,
      [METADATA_KEY_DURATION_SECONDS]: this.formatDuration(
        performance.now() - startTime
      ),
      [METADATA_KEY_TOTAL_TABLES]: this.tables.size,
    });
  }

  private async detectTables(em: EntityManager): Promise<void> {
    const startTime = performance.now();
    const tables = await this.execQuery<Table>(em, "getTables");
    if (!tables) {
      this.logger.debug(LOG_MESSAGE_TABLES_DISCOVERED, {
        [METADATA_KEY_TOTAL_TABLES]: this.tables.size,
        [METADATA_KEY_DURATION_SECONDS]: this.formatDuration(
          performance.now() - startTime
        ),
      });
      return;
    }

    tables.forEach((row) => {
      this.tables.add(row.name);
    });
    this.logger.debug(LOG_MESSAGE_TABLES_DISCOVERED, {
      [METADATA_KEY_TOTAL_TABLES]: this.tables.size,
      [METADATA_KEY_DURATION_SECONDS]: this.formatDuration(
        performance.now() - startTime
      ),
    });
  }

  private async restoreOrder(em: EntityManager): Promise<void> {
    const tables = this.getTablesForRestore();
    const totalTables = tables.length;
    if (this.restoreInOder) {
      this.logger.debug(LOG_MESSAGE_RESTORE_MODE, {
        [METADATA_KEY_MODE]: RESTORE_MODE_ORDERED,
        [METADATA_KEY_TOTAL_TABLES]: totalTables,
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
      this.logger.debug(LOG_MESSAGE_RESTORE_MODE, {
        [METADATA_KEY_MODE]: RESTORE_MODE_PARALLEL,
        [METADATA_KEY_TOTAL_TABLES]: totalTables,
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
    this.logger.info(LOG_MESSAGE_RESTORING_TABLE, {
      [METADATA_KEY_TABLE]: tableName,
      [METADATA_KEY_PROGRESS_CURRENT]: position,
      [METADATA_KEY_PROGRESS_TOTAL]: total,
    });
    await this.execQuery(em, "truncateTable", { tableName });
    this.logger.debug(LOG_MESSAGE_TABLE_TRUNCATED, {
      [METADATA_KEY_TABLE]: tableName,
      [METADATA_KEY_PROGRESS_CURRENT]: position,
      [METADATA_KEY_PROGRESS_TOTAL]: total,
    });
    await this.execQuery(em, "restoreData", { tableName });
    this.logger.debug(LOG_MESSAGE_DATA_RESTORED, {
      [METADATA_KEY_TABLE]: tableName,
      [METADATA_KEY_PROGRESS_CURRENT]: position,
      [METADATA_KEY_PROGRESS_TOTAL]: total,
    });
    await this.resetAutoIncrementColumns(em, tableName);
    this.logger.info(LOG_MESSAGE_TABLE_RESTORED, {
      [METADATA_KEY_TABLE]: tableName,
      [METADATA_KEY_DURATION_SECONDS]: this.formatDuration(
        performance.now() - startTime
      ),
      [METADATA_KEY_PROGRESS_CURRENT]: position,
      [METADATA_KEY_PROGRESS_TOTAL]: total,
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
      this.logger.debug(LOG_MESSAGE_AUTO_INCREMENT_RESET, {
        [METADATA_KEY_TABLE]: tableName,
        [METADATA_KEY_COLUMNS]: column,
        [METADATA_KEY_SEQUENCES]: sequenceName,
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
    this.logger.info(LOG_MESSAGE_SUBSCRIBER_REGISTERED, {
      [METADATA_KEY_DATABASE_TYPE]: this.getType(),
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
    this.logger.debug(LOG_MESSAGE_FILTERED_TABLES, {
      [METADATA_KEY_CHANGED_TABLES]: filtered.length,
      [METADATA_KEY_TOTAL_TABLES]: tables.length,
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
      this.logger.debug(LOG_MESSAGE_CHANGE_DETECTED, {
        [METADATA_KEY_TABLE]: tableName,
        [METADATA_KEY_CHANGED_TABLES]: this.changedTables.size,
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
