import { DataSource } from "typeorm";
import { Basic, Simple, User } from "../entities";
import { ConnectionUtil } from "../utils/connection.util";
import { basic } from "./basic.seed";
import { simple } from "./simple.seed";
import { user } from "./user.seed";

export const seed = async (dataSource: DataSource) => {
  const connectionUtil = new ConnectionUtil(dataSource);
  await connectionUtil.transaction(async (em) => {
    await connectionUtil.seed(em, Simple, simple);
    await connectionUtil.seed(em, User, user);
    await connectionUtil.seed(em, Basic, basic);
  });
};
