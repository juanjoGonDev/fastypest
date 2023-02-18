import { DataSource } from "typeorm";
import { Simple } from "../entities";
import { simple } from "./simple.seed";

export const seed = async (connection: DataSource) => {
  const simpleRepository = connection.manager.getRepository(Simple);
  await simpleRepository.clear();
  await simpleRepository.insert(simple);
};
