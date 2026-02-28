import {
  Connection,
  DataSource,
  EntityManager,
  Table,
} from "typeorm";
import { INDEX_OFFSET_CONFIG } from "./config";
import { detectQueryEvents } from "./query-mediator";
import { SQLScript } from "./sql-script";
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
import {
  configureLogging,
  createScopedLogger,
  LogLevel,
  LOGGING_DETAIL_LEVELS,
  LOGGING_LEVEL_LABELS,
  LOGGING_LEVEL_SEQUENCE,
  LoggingDetailLevel,
} from "../logging";
import type { LoggingOptions, ScopedLogger } from "../logging";

const PROGRESS_OFFSET = 1;

type QueryExecutor = {
  query: (...args: unknown[]) => Promise<unknown>;
};

type QueryRunnerFactory = {
  createQueryRunner: (...args: unknown[]) => QueryExecutor;
};

export class Fastypest extends SQLScript {
  private manager: EntityManager;
  private tables: Set<string> = new Set();
  private tablesWithAutoIncrement: Map<string, IncrementDetail[]> = new Map();
  private restoreInOder: boolean = false;
  private readonly options: Required<Omit<FastypestOptions, "logging">>;
  private readonly changedTables: Set<string> = new Set();
  private readonly logger: ScopedLogger;
  private readonly dbConnection: DataSource | Connection;
  private readonly patchedQueryExecutors: WeakSet<object> = new WeakSet();
  private queryTrackingPaused: boolean = false;
  private hasUnsafeMutations: boolean = false;
  private queryMediatorRegistered: boolean = false;

  constructor(
    connection: DataSource | Connection,
    options?: FastypestOptions
  ) {
    super(connection.options.type);
    const loggingConfiguration = this.resolveLoggingConfiguration(options?.logging);
    const resolvedLogging = configureLogging(loggingConfiguration);
    this.logger = createScopedLogger("Fastypest");
    this.manager = connection.manager;
    this.dbConnection = connection;
    this.options = {
      changeDetectionStrategy:
        options?.changeDetectionStrategy ?? ChangeDetectionStrategy.None,
    };
    const detailLevels =
      resolvedLogging.detail !== undefined
        ? LOGGING_DETAIL_LEVELS[resolvedLogging.detail]
        : undefined;
    const customLevels =
      resolvedLogging.levels && resolvedLogging.levels.length > 0
        ? resolvedLogging.levels
        : undefined;
    const activeLevels = detailLevels && customLevels
      ? customLevels.filter((level) => detailLevels.includes(level))
      : detailLevels ?? customLevels ?? LOGGING_LEVEL_SEQUENCE;
    const activeLevelLabels = activeLevels.map(
      (level) => LOGGING_LEVEL_LABELS[level]
    );
    const detailText =
      resolvedLogging.detail !== undefined
        ? `Style ${
            resolvedLogging.detail === LoggingDetailLevel.Simple
              ? "Simple"
              : "Detailed"
          }`
        : undefined;
    const customLevelText = customLevels
      ? `Selected levels ${customLevels
          .map((level) => LOGGING_LEVEL_LABELS[level])
          .join(", ")}`
      : undefined;
    const activeLevelText =
      detailLevels && customLevels && activeLevels.length === 0
        ? "Active levels none"
        : `Active levels ${activeLevelLabels.join(", ")}`;
    const loggingDetails = [
      detailText,
      customLevelText,
      activeLevelText,
      `Database ${this.getType()}`,
      `Change detection ${this.options.changeDetectionStrategy}`,
    ].filter((entry): entry is string => Boolean(entry));
    if (resolvedLogging.enabled) {
      this.logger.log("🟢 Logging enabled", ...loggingDetails);
    } else {
      this.logger.warn("⚪️ Logging disabled", ...loggingDetails);
    }
    if (this.shouldTrackChanges()) {
      this.logger.info("🛰️ Change detection strategy enabled");
      this.registerQueryMediator();
    }
  }

  public async init(): Promise<void> {
    const timer = this.logger.timer("Initialization");
    this.logger.verbose("🚀 Initialization started", `Database ${this.getType()}`);
    await this.withQueryTrackingPaused(async () => {
      await this.manager.transaction(async (em: EntityManager) => {
        await this.detectTables(em);
        await this.calculateDependencyTables(em);
        const tables = [...this.tables];
        await Promise.all([
          this.createTempTable(em, tables),
          this.detectTablesWithAutoIncrement(em, tables),
        ]);
      });
    });
    timer.end(
      "✅ Initialization completed",
      LogLevel.Info,
      `Tables ${this.tables.size}`,
      `Tables with auto increment ${this.tablesWithAutoIncrement.size}`
    );
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
        this.logger.debug(
          "🧪 Temporary table prepared",
          `Table ${tableName}`,
          `Progress ${index + PROGRESS_OFFSET}/${totalTables}`
        );
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
    this.logger.debug(
      "📊 Auto increment analysis completed",
      `Tables with auto increment ${this.tablesWithAutoIncrement.size}`
    );
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
    this.logger.debug(
      "🔁 Auto increment column processed",
      `Table ${tableName}`,
      `Column ${column.column_name}`,
      `Sequence ${sequenceName}`,
      `Progress ${position}/${total}`
    );
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
    const tablesToRestore = this.getTablesForRestore();
    if (
      this.shouldTrackChanges() &&
      this.changedTables.size === 0 &&
      !this.hasUnsafeMutations
    ) {
      this.logger.debug(
        "🕊️ No tracked table changes detected",
        `Tables ${tablesToRestore.length}`
      );
    }
    const timer = this.logger.timer("Restore process");
    const changeSummary = this.shouldTrackChanges()
      ? `Tracked changes ${this.changedTables.size}`
      : undefined;
    const unsafeSummary = this.shouldTrackChanges()
      ? `Unsafe queries ${this.hasUnsafeMutations ? "yes" : "no"}`
      : undefined;
    this.logger.verbose(
      "🛠️ Restore process started",
      `Tables selected ${tablesToRestore.length}`,
      changeSummary,
      unsafeSummary
    );
    await this.withQueryTrackingPaused(async () => {
      await this.manager.transaction(async (em: EntityManager) => {
        const { foreignKey, restoreOrder } = await this.restoreManager(em);
        await foreignKey.disable();
        await restoreOrder();
        await foreignKey.enable();
      });
    });
    timer.end(
      "🎉 Restore process completed",
      LogLevel.Info,
      `Tables restored ${tablesToRestore.length}`
    );
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
        this.logger.debug(
          "🚧 Foreign keys disabled",
          `Database ${this.getType()}`
        );
        await this.execQuery(em, "foreignKey.disable");
      };
      manager.foreignKey.enable = async (): Promise<void> => {
        await this.execQuery(em, "foreignKey.enable");
        this.logger.debug(
          "🆗 Foreign keys enabled",
          `Database ${this.getType()}`
        );
      };
    }

    manager.restoreOrder = (): Promise<void> => this.restoreOrder(em);

    return manager;
  }

  private async calculateDependencyTables(em: EntityManager): Promise<void> {
    const timer = this.logger.timer("Dependency planning");
    this.logger.debug("🧭 Calculating dependency order for restore");
    const dependencyTree = await this.execQuery<DependencyTreeQueryOut>(
      em,
      "dependencyTree"
    );

    if (!dependencyTree.length) {
      this.restoreInOder = false;
      timer.end(
        "🧭 Dependency order calculated",
        LogLevel.Debug,
        "Mode parallel",
        `Tables ${this.tables.size}`
      );
      return;
    }

    const sortedTables = new Set(dependencyTree.map((row) => row.table_name));
    this.tables.clear();
    this.tables = sortedTables;
    this.restoreInOder = true;
    timer.end(
      "🧭 Dependency order calculated",
      LogLevel.Debug,
      "Mode ordered",
      `Tables ${this.tables.size}`
    );
  }

  private async detectTables(em: EntityManager): Promise<void> {
    const timer = this.logger.timer("Table discovery");
    this.logger.debug("🗂️ Discovering tables from database");
    const tables = await this.execQuery<Table>(em, "getTables");
    if (!tables) {
      timer.end(
        "🗂️ Table discovery completed",
        LogLevel.Debug,
        `Tables ${this.tables.size}`
      );
      return;
    }

    tables.forEach((row) => {
      this.tables.add(row.name);
    });
    timer.end(
      "🗂️ Table discovery completed",
      LogLevel.Debug,
      `Tables ${this.tables.size}`
    );
  }

  private async restoreOrder(em: EntityManager): Promise<void> {
    const tables = this.getTablesForRestore();
    const totalTables = tables.length;
    if (this.restoreInOder) {
      this.logger.verbose("🧱 Restore mode ordered", `Tables ${totalTables}`);
      for (const [index, tableName] of tables.entries()) {
        await this.recreateData(
          em,
          tableName,
          index + PROGRESS_OFFSET,
          totalTables
        );
      }
    } else {
      this.logger.verbose("🧱 Restore mode parallel", `Tables ${totalTables}`);
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
      this.hasUnsafeMutations = false;
    }
  }

  private async recreateData(
    em: EntityManager,
    tableName: string,
    position: number,
    total: number
  ): Promise<void> {
    const timer = this.logger.timer(`Restore ${tableName}`);
    this.logger.debug(
      "📥 Restoring table",
      `Table ${tableName}`,
      `Progress ${position}/${total}`
    );
    await this.execQuery(em, "truncateTable", { tableName });
    timer.mark(
      "🧹 Table truncated",
      LogLevel.Debug,
      `Table ${tableName}`,
      `Progress ${position}/${total}`
    );
    await this.execQuery(em, "restoreData", { tableName });
    timer.mark(
      "📦 Table data restored",
      LogLevel.Debug,
      `Table ${tableName}`,
      `Progress ${position}/${total}`
    );
    await this.resetAutoIncrementColumns(em, tableName);
    timer.end(
      "✅ Table restored",
      LogLevel.Info,
      `Table ${tableName}`,
      `Progress ${position}/${total}`
    );
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
      this.logger.debug(
        "♻️ Auto increment column reset",
        `Table ${tableName}`,
        `Column ${column}`,
        `Sequence ${sequenceName}`,
        `Next value ${index}`
      );
    }
  }

  private registerQueryMediator(): void {
    if (this.queryMediatorRegistered) {
      return;
    }
    this.patchQueryExecutor(this.dbConnection as unknown as QueryExecutor);
    this.patchQueryRunnerFactory();
    this.queryMediatorRegistered = true;
    this.logger.info(
      "📡 Query mediator registered",
      `Database ${this.getType()}`
    );
  }

  private patchQueryRunnerFactory(): void {
    const connection = this.dbConnection as unknown as Partial<QueryRunnerFactory>;
    if (!connection.createQueryRunner) {
      return;
    }
    const originalCreateQueryRunner = connection.createQueryRunner.bind(
      this.dbConnection
    );
    connection.createQueryRunner = (...args: unknown[]): QueryExecutor => {
      const queryRunner = originalCreateQueryRunner(...args);
      this.patchQueryExecutor(queryRunner);
      return queryRunner;
    };
  }

  private patchQueryExecutor(executor: QueryExecutor): void {
    const reference = executor as unknown as object;
    if (this.patchedQueryExecutors.has(reference)) {
      return;
    }
    const originalQuery = executor.query.bind(executor);
    executor.query = async (...args: unknown[]): Promise<unknown> => {
      const query = args[0];
      if (typeof query === "string") {
        this.handleExecutedQuery(query);
      }
      return await originalQuery(...args);
    };
    this.patchedQueryExecutors.add(reference);
  }

  private handleExecutedQuery(query: string): void {
    if (!this.shouldTrackChanges() || this.queryTrackingPaused) {
      return;
    }
    const events = detectQueryEvents(this.getType(), query);
    events.forEach((event) => {
      if (event.type === "tableTouched") {
        this.trackChangedTable(event.tableName);
        return;
      }
      if (event.type === "unsupportedMutation" && !this.hasUnsafeMutations) {
        this.hasUnsafeMutations = true;
        this.logger.warn(
          "⚠️ Unsafe query detected, full restore enabled",
          `Database ${this.getType()}`
        );
      }
    });
  }

  private trackChangedTable(tableName: string): void {
    const normalizedTableName = this.resolveTrackedTableName(tableName);
    const wasTracked = this.changedTables.has(normalizedTableName);
    this.changedTables.add(normalizedTableName);
    if (!wasTracked) {
      this.logger.debug(
        "🔎 Table change detected",
        `Table ${normalizedTableName}`,
        `Tracked tables ${this.changedTables.size}`
      );
    }
  }

  private shouldTrackChanges(): boolean {
    return this.options.changeDetectionStrategy === ChangeDetectionStrategy.Query;
  }

  private getTablesForRestore(): string[] {
    const tables = [...this.tables];
    if (!this.shouldTrackChanges()) {
      return tables;
    }
    if (this.hasUnsafeMutations) {
      this.logger.warn(
        "🛡️ Restoring all tables because unsafe queries were detected",
        `Tables ${tables.length}`
      );
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
    this.logger.debug(
      "🗜️ Filtering tables by tracked changes",
      `Matched tables ${filtered.length}`,
      `Total tables ${tables.length}`
    );
    return filtered;
  }

  private resolveTrackedTableName(tableName: string): string {
    if (this.tables.has(tableName)) {
      return tableName;
    }
    const normalizedTableName = tableName.toLowerCase();
    for (const knownTableName of this.tables) {
      if (knownTableName.toLowerCase() === normalizedTableName) {
        return knownTableName;
      }
    }
    return tableName;
  }

  private async withQueryTrackingPaused<T>(
    callback: () => Promise<T>
  ): Promise<T> {
    const previousTrackingState = this.queryTrackingPaused;
    this.queryTrackingPaused = true;
    try {
      return await callback();
    } finally {
      this.queryTrackingPaused = previousTrackingState;
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
}
