import { DataSource } from "typeorm";
import { Simple } from "../entities";

const dataBaseSource = new DataSource({
  type: (process.env.DATABASE_TYPE as any) || "mysql",
  host: "localhost",
  username: "test_user",
  password: "password",
  entities: [Simple],
  database: "test",
  synchronize: true,
});

export const initialize = () => dataBaseSource.initialize();

export const getConnection = () => dataBaseSource;
