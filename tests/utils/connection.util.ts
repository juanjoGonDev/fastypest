import { DataSource, EntityManager } from "typeorm";
import { SQLScript } from "../../dist/core/sql-script";
import { getConnection } from "../config";

export class ConnectionUtil extends SQLScript {
  private connection: DataSource;
  constructor() {
    super(getConnection().options.type);
    this.connection = getConnection();
  }

  async transaction(
    handler: (entityManager: EntityManager) => Promise<unknown>
  ) {
    await this.connection.transaction(async (em) => {
      await em.query(this.getQuery("foreignKey.disable"));
      await handler(em);
      await em.query(this.getQuery("foreignKey.enable"));
    });
  }
}
