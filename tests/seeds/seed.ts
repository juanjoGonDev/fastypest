import { Simple, User } from "../entities";
import { ConnectionUtil } from "../utils";
import { simple } from "./simple.seed";
import { user } from "./user.seed";

export const seed = async () => {
  const connectionUtil = new ConnectionUtil();
  await connectionUtil.transaction(async (em) => {
    await connectionUtil.seed(em, Simple, simple);
    await connectionUtil.seed(em, User, user);
  });
};
