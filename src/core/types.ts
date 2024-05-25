import { DataSourceOptions } from "typeorm";

export type Table = { name: string };
export type DependencyTreeQueryOut = {
  table_name: string;
  level: number;
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
