import COCKROACHDB_QUERIES from "./cockroachdb.json";
import MYSQL_QUERIES from "./mysql.query.json";
import POSTGRES_QUERIES from "./postgres.query.json";

export const DB_QUERIES = {
  mysql: MYSQL_QUERIES,
  mariadb: MYSQL_QUERIES,
  postgres: POSTGRES_QUERIES,
  cockroachdb: COCKROACHDB_QUERIES,
};

export type AllowedDataBases = keyof typeof DB_QUERIES;
export type Queries = (typeof DB_QUERIES)[AllowedDataBases];
