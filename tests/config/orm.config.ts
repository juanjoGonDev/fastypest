import { DataSource } from "typeorm";
import { Simple } from "../entities";

const dataBaseSource = new DataSource({
  type: (process.env.DATABASE_TYPE as any) || "mysql",
  host: "localhost",
  username: String(process.env.DB_USER) || "root",
  password: String(process.env.DB_PASSWORD) || "password",
  entities: [Simple],
  database: String(process.env.DB_NAME) || "test",
  synchronize: true,
});

export const initialize = () => dataBaseSource.initialize();

export const getConnection = () => dataBaseSource;
