import { DataSource, EntityManager, EntityTarget } from "typeorm";
import { Fastypest } from "../../dist";
import { Simple, User } from "../entities";
import { simple } from "./simple.seed";
import { user } from "./user.seed";

export const seed = async (connection: DataSource) => {
  const seed = new Seed(connection);
  await connection.manager.transaction(async (em) => {
    const foreignKeyManager = await seed.foreignKeyManager(em);
    await foreignKeyManager.disable();

    await seed.seed(em, Simple, simple);
    await seed.seed(em, User, user);

    await foreignKeyManager.enable();
  });
};

class Seed extends Fastypest {
  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  async seed(em: EntityManager, target: EntityTarget<any>, data: object[]) {
    const repository = em.getRepository(target);
    const truncateQuery = this.getQuery("truncateTable", {
      tableName: repository.metadata.tableName,
    });
    await em.query(truncateQuery);
    await repository.insert(data);
  }
}
