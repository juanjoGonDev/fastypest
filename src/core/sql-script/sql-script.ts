import { DataSourceOptions, EntityManager } from "typeorm";
import { AllowedDataBases, DB_QUERIES, Queries } from "./queries";
import { QueryPath } from "./types";

type DBTypes = DataSourceOptions["type"];

export class SQLScript {
  private queries: Queries;

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

    for (const key in values) {
      query = query.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), values[key]);
    }

    return em.query(query) as T extends void ? Promise<void> : Promise<T[]>;
  }
}
