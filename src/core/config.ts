import { DBType } from "./types";

export const INDEX_OFFSET_CONFIG: Partial<Record<DBType, number>> = {
  postgres: 1,
  cockroachdb: 0,
};

const TABLE_IDENTIFIER_PATTERN =
  '((?:(?:"[^"]+")|(?:`[^`]+`)|(?:[a-zA-Z_][a-zA-Z0-9_$]*))(?:\\.(?:(?:"[^"]+")|(?:`[^`]+`)|(?:[a-zA-Z_][a-zA-Z0-9_$]*)))?)';

const createTableRegex = (statement: string): RegExp =>
  new RegExp(`^\\s*${statement}\\s+${TABLE_IDENTIFIER_PATTERN}\\b`, "i");

const createDeleteRegex = (): RegExp =>
  new RegExp(`^\\s*delete\\s+from\\s+${TABLE_IDENTIFIER_PATTERN}\\b`, "i");

const createInsertRegex = (): RegExp =>
  new RegExp(`^\\s*insert\\s+into\\s+${TABLE_IDENTIFIER_PATTERN}\\b`, "i");

const createTruncateRegex = (): RegExp =>
  new RegExp(
    `^\\s*truncate\\s+(?:table\\s+)?${TABLE_IDENTIFIER_PATTERN}\\b`,
    "i",
  );

const UNSAFE_MUTATION_REGEXES: ReadonlyArray<RegExp> = [
  /^\s*alter\s+/i,
  /^\s*drop\s+/i,
  /^\s*create\s+/i,
  /^\s*rename\s+/i,
];

type QueryDetectionConfig = {
  trackableMutations: ReadonlyArray<RegExp>;
  unsafeMutations: ReadonlyArray<RegExp>;
};

const TRACKABLE_MUTATION_REGEXES: ReadonlyArray<RegExp> = [
  createInsertRegex(),
  createTableRegex("update"),
  createDeleteRegex(),
  createTruncateRegex(),
];

export const QUERY_DETECTION_CONFIG: Partial<
  Record<DBType, QueryDetectionConfig>
> = {
  mysql: {
    trackableMutations: TRACKABLE_MUTATION_REGEXES,
    unsafeMutations: UNSAFE_MUTATION_REGEXES,
  },
  mariadb: {
    trackableMutations: TRACKABLE_MUTATION_REGEXES,
    unsafeMutations: UNSAFE_MUTATION_REGEXES,
  },
  postgres: {
    trackableMutations: TRACKABLE_MUTATION_REGEXES,
    unsafeMutations: UNSAFE_MUTATION_REGEXES,
  },
  cockroachdb: {
    trackableMutations: TRACKABLE_MUTATION_REGEXES,
    unsafeMutations: UNSAFE_MUTATION_REGEXES,
  },
};
