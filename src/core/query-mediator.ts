import { QUERY_DETECTION_CONFIG } from "./config";
import type { DBType } from "./types";

const TABLE_CAPTURE_GROUP = 1;
const QUERY_SEPARATOR = ";";
const QUOTE_AND_SCHEMA_SEPARATOR = ".";
const QUOTE_TRIMMING_REGEX = /^["`]|["`]$/g;

type QueryDetectionEvent =
  | {
      type: "tableTouched";
      tableName: string;
    }
  | {
      type: "unsupportedMutation";
    }
  | {
      type: "ignored";
    };

const splitStatements = (query: string): string[] => {
  return query
    .split(QUERY_SEPARATOR)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
};

const normalizeIdentifier = (identifier: string): string => {
  const parts = identifier
    .split(QUOTE_AND_SCHEMA_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const tableIdentifier = parts[parts.length - 1];
  return tableIdentifier.replace(QUOTE_TRIMMING_REGEX, "");
};

const getTrackedTable = (
  statement: string,
  regexes: ReadonlyArray<RegExp>
): string | null => {
  for (const regex of regexes) {
    const match = regex.exec(statement);
    if (!match) continue;
    const tableName = match[TABLE_CAPTURE_GROUP];
    if (!tableName) {
      return null;
    }
    return normalizeIdentifier(tableName);
  }
  return null;
};

const isUnsafeMutation = (
  statement: string,
  regexes: ReadonlyArray<RegExp>
): boolean => regexes.some((regex) => regex.test(statement));

export const detectQueryEvents = (
  type: DBType,
  query: string
): QueryDetectionEvent[] => {
  const config = QUERY_DETECTION_CONFIG[type];
  if (!config) {
    return [{ type: "ignored" }];
  }

  const statements = splitStatements(query);
  if (statements.length === 0) {
    return [{ type: "ignored" }];
  }

  return statements.map((statement) => {
    const tableName = getTrackedTable(statement, config.trackableMutations);
    if (tableName) {
      return { type: "tableTouched", tableName };
    }
    if (isUnsafeMutation(statement, config.unsafeMutations)) {
      return { type: "unsupportedMutation" };
    }
    return { type: "ignored" };
  });
};
