import { DataSource, DataSourceOptions } from "typeorm";
import { Simple, User } from "../entities";

const env = process.env;

const options: Record<string, any> = {
  type: (env.DB_TYPE as any) || "mysql",
  host: "127.0.0.1",
  username: "root",
  password: "password",
  entities: [Simple, User],
  database: "test",
  synchronize: true,
  logging: false,
  logger: "file",
};

if (env.DB_PORT !== undefined) {
  options.port = Number(env.DB_PORT);
}

const dataBaseSource = new DataSource(options as DataSourceOptions);

export const initialize = () => dataBaseSource.initialize();

export const getConnection = () => dataBaseSource;
