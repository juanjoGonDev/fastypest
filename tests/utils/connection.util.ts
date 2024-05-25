import { DataSource, EntityManager, EntityTarget } from "typeorm";
import { Fastypest } from "../../dist/core";
import { getConnection } from "../config/orm.config";

export class ConnectionUtil extends Fastypest {
  private connection: DataSource;
  constructor(connection?: DataSource) {
    super(connection || getConnection());
    this.connection = connection || getConnection();
  }

  async transaction(
    handler: (entityManager: EntityManager) => Promise<unknown>
  ) {
    await this.connection.transaction(async (em: EntityManager) => {
      const { foreignKey } = await this.restoreManager(em);
      await foreignKey.disable();
      await handler(em);
      await foreignKey.enable();
    });
  }

  async seed(em: EntityManager, target: EntityTarget<any>, data: object[]) {
    const repository = em.getRepository(target);
    const tableName = repository.metadata.tableName;

    await this.execQuery(em, "truncateTable", { tableName });
    await repository.insert(data);
  }
}
