import { DataSource, DataSourceOptions } from "typeorm";
import {
  Basic,
  CycleA,
  CycleB,
  FkChild,
  FkParent,
  Simple,
  User,
} from "../entities";

const env = process.env;
const TYPE = (env.DB_TYPE as DataSourceOptions["type"] | undefined) || "mysql";

const DEFAULT_PORT_BY_TYPE: Partial<Record<DataSourceOptions["type"], number>> =
  {
    mysql: 3306,
    mariadb: 3307,
    postgres: 5432,
    cockroachdb: 26257,
  };

const resolvePort = (
  rawPort: string | undefined,
  type: DataSourceOptions["type"],
): number | undefined => {
  if (rawPort === undefined) {
    return DEFAULT_PORT_BY_TYPE[type];
  }
  const parsedPort = Number(rawPort);
  if (Number.isFinite(parsedPort)) {
    return parsedPort;
  }
  return DEFAULT_PORT_BY_TYPE[type];
};

const PORT = resolvePort(env.DB_PORT, TYPE);

type DataSourceOptionsWithPort = DataSourceOptions & { port?: number };

const options = {
  type: TYPE,
  host: "127.0.0.1",
  username: "fastypest",
  password: "password",
  entities: [Simple, User, Basic, FkParent, FkChild, CycleA, CycleB],
  database: "test",
  synchronize: false,
  dropSchema: false,
  logging: false,
  logger: "file",
} as DataSourceOptionsWithPort;

if (PORT !== undefined && Number.isFinite(PORT)) {
  options.port = PORT;
}

const dataBaseSource = new DataSource(options);

export const prepareDatabase = async (): Promise<DataSource> => {
  const sourceOptions = { ...options, dropSchema: true, synchronize: true };
  const source = new DataSource(sourceOptions);
  return source.initialize();
};

export const initialize = async (): Promise<DataSource> => {
  return dataBaseSource.initialize();
};

export const getConnection = (): DataSource => dataBaseSource;
