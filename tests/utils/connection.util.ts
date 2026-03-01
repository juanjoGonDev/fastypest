import {
  DataSource,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
} from "typeorm";
import {
  Fastypest,
  type FastypestOptions,
} from "../../src/core";
import { getConnection } from "../config/orm.config";

export class ConnectionUtil extends Fastypest {
  private connection: DataSource;
  constructor(connection?: DataSource, options?: FastypestOptions) {
    const resolvedConnection = connection || getConnection();
    super(resolvedConnection, options);
    this.connection = resolvedConnection;
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

  async seed<Entity extends ObjectLiteral>(
    em: EntityManager,
    target: EntityTarget<Entity>,
    data: Array<Partial<Entity>>,
  ) {
    const repository = em.getRepository(target);
    const tableName = repository.metadata.tableName;

    await this.execQuery(em, "truncateTable", { tableName });
    await repository
      .createQueryBuilder()
      .insert()
      .into(target)
      .values(data)
      .execute();
  }
}
