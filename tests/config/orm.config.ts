import { DataSource, DataSourceOptions } from "typeorm";
import { Simple, User } from "../entities";

const env = process.env;
const TYPE: string = env.DB_TYPE || "mysql";
const PORT: number = Number(env.DB_PORT);

const options: Record<string, any> = {
  type: TYPE,
  host: "127.0.0.1",
  username: "fastypest",
  password: "password",
  entities: [Simple, User],
  database: "test",
  synchronize: true,
  dropSchema: true,
  logging: false,
  logger: "file",
};

if (PORT !== undefined) {
  options.port = PORT;
}

const dataBaseSource = new DataSource(options as DataSourceOptions);

export const initialize = async (): Promise<DataSource> => {
  const connection = await dataBaseSource.initialize();

  return connection;
};

export const getConnection = (): DataSource => dataBaseSource;
