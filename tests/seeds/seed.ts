import { DataSource } from "typeorm";
import { Simple } from "../entities";
import { simple } from "./simple.seed";

export const seed = async (connection: DataSource) => {
  await connection.manager.transaction(async (em) => {
    const simpleRepository = em.getRepository(Simple);
    await simpleRepository.clear();
    await simpleRepository.insert(simple);
  });
};
