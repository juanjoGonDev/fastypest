import { DataSource } from "typeorm";
import { Simple } from "../entities";

const databaseType: any = process.env.DATABASE_TYPE;
const dataBaseSource = new DataSource({
  type: databaseType || "mysql",
  port: 3306,
  host: "localhost",
  username: "root",
  password: "password",
  entities: [Simple],
  database: "test",
  synchronize: true,
});

export const initialize = () => dataBaseSource.initialize();

export const getConnection = () => dataBaseSource;
