import { DataSource, EntityManager } from "typeorm";
import { Fastypest } from "../../dist";
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
      const foreignKeyManager = await this.foreignKeyManager(em);
      await foreignKeyManager.disable();
      await handler(em);
      await foreignKeyManager.enable();
    });
  }
}
