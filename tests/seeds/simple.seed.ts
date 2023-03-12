import { seedCount } from "../config";
import { Simple } from "../entities";

export const simple: Partial<Simple>[] = [];

for (let x = 1; x <= seedCount; x++) {
  simple.push({
    name: `Seed ${x}`,
  });
}
