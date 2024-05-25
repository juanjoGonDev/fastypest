import { seedCount } from "../config/seed.config";
import { Basic } from "../entities";

export const basic: Partial<Basic>[] = [];

for (let x = 1; x <= seedCount; x++) {
  basic.push({
    name: `Basic ${x}`,
    simpleId: x,
  });
}
