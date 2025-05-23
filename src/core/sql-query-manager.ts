import { DBType } from './types';
import { EntityManager } from 'typeorm';
import { Fastypest } from './fastypest'; // Assuming Fastypest is in the same directory level

export class SQLQueryManager {
  private dbType: DBType;
  private manager: EntityManager;
  private fastypestInstance: Fastypest; // To access loadQuery

  constructor(dbType: DBType, manager: EntityManager, fastypestInstance: Fastypest) {
    this.dbType = dbType;
    this.manager = manager;
    this.fastypestInstance = fastypestInstance;
  }

  public async execQuery<T = any>(
    em: EntityManager,
    queryPath: string, // Renamed from queryKey
    values?: Record<string, string> // Changed from options to values
  ): Promise<T[] | undefined> { // Return type adjusted
    try {
      // Call the new method on Fastypest instance, which internally calls SQLScript's execQuery
      // Assuming T is not void for simplicity here.
      // SQLScript.execQuery returns Promise<T[]> when T is not void.
      const result = await this.fastypestInstance.executeQueryFromSqlScript<T>(em, queryPath, values);
      return result;
    } catch (error) {
      console.error(`Error executing query ${queryPath}:`, error);
      // SQLScript.execQuery (called by executeQueryFromSqlScript) will throw if queryPath is invalid.
      // So, this catch block will handle those errors.
      throw error; 
    }
  }
}
