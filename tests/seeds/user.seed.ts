import { seedCount } from "../config";
import { User } from "../entities";

export const user: Partial<User>[] = [];

for (let x = 1; x <= seedCount; x++) {
  user.push({
    name: `User ${x}`,
    simpleId: x,
  });
}
