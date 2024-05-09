import { DataSource, EntityManager, EntityTarget } from "typeorm";
import { Fastypest } from "../../dist/core";
import { getConnection } from "../config";

export class ConnectionUtil extends Fastypest {
  private connection: DataSource;
  constructor() {
    super(getConnection());
    this.connection = getConnection();
  }

  async transaction(
    handler: (entityManager: EntityManager) => Promise<unknown>
  ) {
    await this.connection.transaction(async (em) => {
      const restoreManager = await this.restoreManager(em);
      await restoreManager.foreignKey.disable();
      await handler(em);
      await restoreManager.foreignKey.enable();
    });
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
