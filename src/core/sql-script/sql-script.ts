import { DataSourceOptions } from "typeorm";
import { AllowedDataBases, DB_QUERIES, Queries } from "./queries";
import { QueryPath } from "./types";

type DBTypes = DataSourceOptions["type"];

export class SQLScript {
  queries: Queries;
  constructor(private readonly type: DBTypes) {
    if (!(this.type in DB_QUERIES)) {
      throw new Error(
        `The database type provided is not supported. Please choose from the following: ${Object.keys(
          DB_QUERIES
        )}`
      );
    }

    this.queries = DB_QUERIES[this.type as AllowedDataBases];
  }

  protected getQuery(
    queryPath: QueryPath<Queries>,
    values?: Record<string, string>
  ): string {
    const queryObj = queryPath
      .split(".")
      .reduce((obj: any, key) => obj[key], this.queries);

    let queryStr = queryObj;

    for (const key in values) {
      queryStr = queryStr.replace(
        new RegExp(`{{\\s*${key}\\s*}}`, "g"),
        values[key]
      );
    }

    return queryStr;
  }
}
