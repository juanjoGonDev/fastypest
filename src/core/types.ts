import { DataSourceOptions } from "typeorm";
import type { LoggingOptions } from "../logging";

export type DependencyTreeQueryOut = {
  table_name: string;
  level: number;
};

export type TableDependencyQueryOut = {
  table_name: string;
  referenced_table_name: string;
};

/**
 * Controls how Fastypest decides which tables should be restored after each test.
 */
export enum ChangeDetectionStrategy {
  /**
   * Always restore every discovered table.
   */
  None = "none",
  /**
   * Track executed SQL statements and restore only the affected tables.
   */
  Query = "query",
}

export type FastypestOptions = {
  /**
   * Change detection strategy used by Fastypest. Defaults to `ChangeDetectionStrategy.Query`.
   */
  changeDetectionStrategy?: ChangeDetectionStrategy;
  logging?: boolean | LoggingOptions;
};

export type ColumnsWithAutoIncrement = {
  column_name: string;
  column_default: string;
};

export type Manager = {
  foreignKey: {
    disable: () => Promise<void>;
    enable: () => Promise<void>;
  };
  restoreOrder: () => Promise<void>;
};
export type ColumnStat = { maxindex: string | null };
export type DBType = DataSourceOptions["type"];
export type IncrementDetail = {
  column: string;
  sequenceName: string;
  index: string;
};
