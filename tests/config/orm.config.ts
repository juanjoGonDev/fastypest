import { DataSource } from "typeorm";
import { Simple } from "../entities";

const dataBaseSource = new DataSource({
  type: (process.env.DATABASE_TYPE as any) || "mysql",
  host: "127.0.0.1",
  username: "root",
  password: "password",
  entities: [Simple],
  database: "test",
  synchronize: true,
  logging: false,
  schema: "test",
});

export const initialize = () => dataBaseSource.initialize();

export const getConnection = () => dataBaseSource;
