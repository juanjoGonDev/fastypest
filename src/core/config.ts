import { DBType } from "./types";

export const INDEX_OFFSET_CONFIG: Partial<Record<DBType, number>> = {
  postgres: 1,
  cockroachdb: 0,
};
