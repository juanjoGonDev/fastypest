import { DataSourceOptions, EntityManager } from "typeorm";
import { AllowedDataBases, DB_QUERIES, Queries } from "./queries";
import { QueryPath } from "./types";
import { createScopedLogger } from "../../logging";

const LOG_SCOPE_SQL_SCRIPT = "SQLScript";
const LOG_MESSAGE_EXECUTING_QUERY = "Executing query";
const METADATA_KEY_QUERY_PATH = "queryPath";
const METADATA_KEY_VALUES = "values";

type DBTypes = DataSourceOptions["type"];

export class SQLScript {
  private queries: Queries;
  private readonly scriptLogger = createScopedLogger(LOG_SCOPE_SQL_SCRIPT);

  protected constructor(private readonly type: DBTypes) {
    if (!(this.type in DB_QUERIES)) {
      throw new Error(
        `The database type provided is not supported. Please choose from the following: ${Object.keys(
          DB_QUERIES
        )}`
      );
    }

    this.queries = DB_QUERIES[this.type as AllowedDataBases];
  }

  protected getType(): DBTypes {
    return this.type;
  }

  protected execQuery<T = void>(
    em: EntityManager,
    queryPath: QueryPath<Queries>,
    values?: Record<string, string>
  ): T extends void ? Promise<void> : Promise<T[]> {
    const queryObj = queryPath
      .split(".")
      .reduce((obj: any, key) => obj[key], this.queries);

    let query = queryObj;

    if (values) {
      for (const key in values) {
        query = query.replace(
          new RegExp(`{{\\s*${key}\\s*}}`, "g"),
          values[key]
        );
      }
    }

    this.scriptLogger.debug(LOG_MESSAGE_EXECUTING_QUERY, {
      [METADATA_KEY_QUERY_PATH]: queryPath,
      [METADATA_KEY_VALUES]: values,
    });
    return em.query(query) as T extends void ? Promise<void> : Promise<T[]>;
  }
}
