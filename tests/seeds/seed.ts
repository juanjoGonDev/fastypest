import {
  DataSource,
  DataSourceOptions,
  EntityManager,
  EntityTarget,
} from "typeorm";
import { SQLScript } from "../../dist/core/sql-script";
import { Simple, User } from "../entities";
import { simple } from "./simple.seed";
import { user } from "./user.seed";

export const seed = async (connection: DataSource) => {
  const seed = new Seed(connection.options.type);
  await connection.manager.transaction(async (em) => {
    await seed.seed(em, Simple, simple);
    await seed.seed(em, User, user);
  });
};

class Seed extends SQLScript {
  constructor(dbType: DataSourceOptions["type"]) {
    super(dbType);
  }

  async seed(em: EntityManager, target: EntityTarget<any>, data: object[]) {
    const repository = em.getRepository(target);
    const queries = {
      truncate: this.getQuery("truncateTable", {
        tableName: repository.metadata.tableName,
      }),
      fk_enable: this.getQuery("foreignKey.enable"),
      fk_disable: this.getQuery("foreignKey.disable"),
    };
    await em.query(queries.fk_disable);
    await em.query(queries.truncate);
    await repository.insert(data);
    await em.query(queries.fk_disable);
  }
}
