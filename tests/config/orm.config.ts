import { DataSource, DataSourceOptions } from "typeorm";
import { Basic, Simple, User } from "../entities";

const env = process.env;
const TYPE: string = env.DB_TYPE || "mysql";
const PORT: number = Number(env.DB_PORT);

const options: Record<string, any> = {
  type: TYPE,
  host: "127.0.0.1",
  username: "fastypest",
  password: "password",
  entities: [Simple, User, Basic],
  database: "test",
  synchronize: false,
  dropSchema: false,
  logging: false,
  logger: "file",
};

if (PORT !== undefined) {
  options.port = PORT;
}

const dataBaseSource = new DataSource(options as DataSourceOptions);

export const prepareDatabase = async (): Promise<DataSource> => {
  const sourceOptions = { ...options, dropSchema: true, synchronize: true };
  const source = new DataSource(sourceOptions as DataSourceOptions);
  return source.initialize();
};

export const initialize = async (): Promise<DataSource> => {
  return dataBaseSource.initialize();
};

export const getConnection = (): DataSource => dataBaseSource;
