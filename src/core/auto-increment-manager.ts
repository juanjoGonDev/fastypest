import { DBType, ColumnsWithAutoIncrement, ColumnStat, IncrementDetail } from './types'; // Added missing types, removed TableDetails
import { SQLQueryManager } from './sql-query-manager';
// Removed direct import of INDEX_OFFSET_CONFIG
import { EntityManager } from 'typeorm'; // Added EntityManager import

export class AutoIncrementManager {
  private readonly dbType: DBType;
  private readonly queryManager: SQLQueryManager;
  private readonly tablesWithAutoIncrement: Map<string, IncrementDetail[]>;
  private readonly manager: EntityManager;
  private readonly indexOffsetConfig: Partial<Record<DBType, number>>; // Added property for the config

  constructor(
    dbType: DBType,
    queryManager: SQLQueryManager,
    manager: EntityManager,
    indexOffsetConfig: Partial<Record<DBType, number>> // Added config to constructor
  ) {
    this.dbType = dbType;
    this.queryManager = queryManager;
    this.tablesWithAutoIncrement = new Map<string, IncrementDetail[]>();
    this.manager = manager;
    this.indexOffsetConfig = indexOffsetConfig; // Store the config
  }

  public async detectTablesWithAutoIncrement(em: EntityManager, tables: string[]): Promise<void> {
    for (const table of tables) {
      await this.processTable(em, table);
    }
  }

  private async processTable(em: EntityManager, tableName: string): Promise<void> {
    const columns = await this.getColumnsWithAutoIncrement(em, tableName);
    if (!columns) return;

    for (const column of columns) {
      await this.processColumn(em, tableName, column);
    }
  }
  
  private async getColumnsWithAutoIncrement(em: EntityManager, tableName: string): Promise<ColumnsWithAutoIncrement[] | null> {
    // Assuming execQuery now takes EntityManager as the first argument
    const columns = await this.queryManager.execQuery<ColumnsWithAutoIncrement>(
      em, // Pass EntityManager
      "getColumnsWithAutoIncrement", // Query key
      { tableName } // Options
    );
    return Array.isArray(columns) ? columns : null;
  }

  private async processColumn(em: EntityManager, tableName: string, column: ColumnsWithAutoIncrement): Promise<void> {
    const stat = await this.getMaxColumnIndex(em, tableName, column.column_name);
    // Corrected: getSequenceName is now part of this class, and it needs EntityManager
    const sequenceName = this.getSequenceName(column.column_default);
    if (!sequenceName) return;

    const index = Number(stat?.maxindex) || 0;
    // Use the injected indexOffsetConfig
    const offset = this.indexOffsetConfig[this.dbType] ?? 1000; // Simplified offset logic based on current config structure
    this.updateTablesWithAutoIncrementMap(tableName, {
      column: column.column_name,
      sequenceName,
      index: String(index + offset), // Apply the offset
    });
  }

  private async getMaxColumnIndex(em: EntityManager, tableName: string, columnName: string): Promise<ColumnStat | null> {
    const result = await this.queryManager.execQuery<ColumnStat>(
      em,
      "getMaxColumnIndex",
      { tableName, column_name: columnName }
    );
    if (Array.isArray(result)) {
      return result.length > 0 ? result[0] : null;
    } else if (result) { // If result is a single ColumnStat object (and not undefined)
      return result;
    }
    return null; // If result is undefined
  }
  
  private getSequenceName(columnDefault: string): string | null {
    const match = columnDefault?.match(/'([^']+)'/);
    return match?.[1] || null;
  }

  private updateTablesWithAutoIncrementMap(tableName: string, data: IncrementDetail): void {
    if (!this.tablesWithAutoIncrement.has(tableName)) {
      this.tablesWithAutoIncrement.set(tableName, []);
    }
    this.tablesWithAutoIncrement.get(tableName)?.push(data);
  }

  public async resetAutoIncrementColumns(em: EntityManager, tableName: string): Promise<void> {
    const tableDetailsList = this.tablesWithAutoIncrement.get(tableName);
    if (!tableDetailsList) return;

    for (const details of tableDetailsList) {
      await this.queryManager.execQuery(
        em,
        "resetAutoIncrementColumn",
        {
          tableName: tableName,
          columnName: details.column,
          sequenceName: details.sequenceName,
          newInitialValue: details.index 
        }
      );
      console.log(`Auto-increment for ${tableName}.${details.column} reset to ${details.index}.`);
    }
  }

  public getTablesWithAutoIncrement(): Map<string, IncrementDetail[]> {
    return this.tablesWithAutoIncrement;
  }
}
