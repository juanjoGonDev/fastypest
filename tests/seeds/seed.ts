import { DataSource } from "typeorm";
import { Simple } from "../entities";
import { simple } from "./simple.seed";

export const seed = async (connection: DataSource) => {
  await connection.manager.transaction(async (em) => {
    const repository = em.getRepository(Simple);
    await em.query(truncate(connection, repository.metadata.tableName));
    await repository.insert(simple);
  });
};

const truncate = (connection: DataSource, tableName: string) => {
  const dbType = connection.options.type;
  const resetID: Record<string, string> = {
    postgres: `TRUNCATE TABLE ${tableName} RESTART IDENTITY`,
    mysql: `TRUNCATE TABLE ${tableName}`,
    mariadb: `TRUNCATE TABLE ${tableName}`,
  };

  return resetID[dbType];
};
