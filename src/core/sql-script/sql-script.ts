import { DataSourceOptions, EntityManager } from "typeorm";
import { AllowedDataBases, DB_QUERIES, Queries } from "./queries";
import { QueryPath } from "./types";
import { createScopedLogger } from "../../logging";

type DBTypes = DataSourceOptions["type"];

export class SQLScript {
  private queries: Queries;
  private readonly scriptLogger = createScopedLogger("SQLScript");

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

    const parameterEntries = values
      ? Object.entries(values).map(([key, value]) => `${key}=${value}`)
      : [];
    this.scriptLogger.debug(
      "Executing SQL query",
      `Path ${queryPath}`,
      parameterEntries.length > 0 ? `Parameters ${parameterEntries.join(", ")}` : undefined
    );
    return em.query(query) as T extends void ? Promise<void> : Promise<T[]>;
  }
}
