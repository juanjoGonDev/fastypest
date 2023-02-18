import { Simple } from "../entities";

export const simple: Partial<Simple>[] = [];

export const seedCount = process.env.Seed_COUNT || 5_000;

for (let x = 1; x <= seedCount; x++) {
  simple.push({
    name: `Seed ${x}`,
  });
}
