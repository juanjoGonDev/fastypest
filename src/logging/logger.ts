import { addColors, createLogger, format, transports } from "winston";
import {
  LOGGING_COLORS,
  LOGGING_DEFAULT_ENABLED,
  LOGGING_DEFAULT_LEVEL,
  LOGGING_DEFAULT_SCOPE,
  LOGGING_LEVEL_ICONS,
  LOGGING_LEVEL_LABELS,
  LOGGING_LEVEL_WEIGHTS,
  LOGGING_METADATA_KEY_VALUE_SEPARATOR,
  LOGGING_METADATA_SEPARATOR,
  LOGGING_TIMESTAMP_FORMAT,
  LogLevel,
  type LoggingOptions,
  type ResolvedLoggingOptions,
} from "./constants";

type LogMetadata = Record<string, unknown>;
type LoggerInfo = Record<string, unknown> & {
  level: string;
  message: string;
};

const LOG_FIELD_LABEL = "label";
const LOG_FIELD_METADATA = "metadata";
const LOG_FIELD_MESSAGE = "message";
const LOG_FIELD_LEVEL = "level";
const LOG_FIELD_TIMESTAMP = "timestamp";
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/g;

const extractLevel = (info: LoggerInfo): LogLevel | undefined => {
  const levelText = (info[LOG_FIELD_LEVEL] as string | undefined) ?? info.level;
  if (!levelText) {
    return undefined;
  }
  const normalized = levelText.replace(ANSI_ESCAPE_PATTERN, "").toLowerCase();
  return normalized in LOGGING_LEVEL_WEIGHTS ? (normalized as LogLevel) : undefined;
};
const formatValue = (value: unknown): string => {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => formatValue(entry)).join(", ");
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

const formatMetadata = (metadata: LogMetadata | undefined): string => {
  if (!metadata) {
    return "";
  }
  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return "";
  }
  return entries
    .map(([key, value]) => `${key}${LOGGING_METADATA_KEY_VALUE_SEPARATOR}${formatValue(value)}`)
    .join(LOGGING_METADATA_SEPARATOR);
};

const formatLogMessage = (info: LoggerInfo): string => {
  const label = info[LOG_FIELD_LABEL] as string | undefined;
  const metadata = info[LOG_FIELD_METADATA] as LogMetadata | undefined;
  const timestamp = info[LOG_FIELD_TIMESTAMP] as string | undefined;
  const level = extractLevel(info);
  const fallbackLevel = info.level.replace(ANSI_ESCAPE_PATTERN, "").toUpperCase();
  const message = info[LOG_FIELD_MESSAGE] ? String(info[LOG_FIELD_MESSAGE]) : info.message;
  const levelLabel = level ? LOGGING_LEVEL_LABELS[level] : fallbackLevel;
  const levelIcon = level ? `${LOGGING_LEVEL_ICONS[level]} ` : "";
  const metadataText = formatMetadata(metadata);
  const formattedMetadata = metadataText ? `${LOGGING_METADATA_SEPARATOR}${metadataText}` : "";
  const timestampText = timestamp ? `${timestamp} ` : "";
  return `${timestampText}${levelIcon}[${label ?? LOGGING_DEFAULT_SCOPE}] ${levelLabel} ${message}${formattedMetadata}`;
};

addColors(LOGGING_COLORS);

const baseLogger = createLogger({
  levels: LOGGING_LEVEL_WEIGHTS,
  level: LogLevel.Debug,
  format: format.combine(
    format.timestamp({ format: LOGGING_TIMESTAMP_FORMAT }),
    format.metadata({ fillExcept: [LOG_FIELD_MESSAGE, LOG_FIELD_LEVEL, LOG_FIELD_TIMESTAMP, LOG_FIELD_LABEL] }),
    format.colorize({ all: true }),
    format.printf((info: unknown) => formatLogMessage(info as LoggerInfo))
  ),
  transports: [new transports.Console()],
  silent: false,
});

let globalOptions: ResolvedLoggingOptions = {
  enabled: LOGGING_DEFAULT_ENABLED,
  level: LOGGING_DEFAULT_LEVEL,
};

const resolveEnabled = (enabled: boolean | undefined, hasOptions: boolean): boolean => {
  if (enabled !== undefined) {
    return enabled;
  }
  if (hasOptions) {
    return true;
  }
  return LOGGING_DEFAULT_ENABLED;
};

const resolveLoggingOptions = (options?: LoggingOptions): ResolvedLoggingOptions => {
  const hasOptions = Boolean(options);
  return {
    enabled: resolveEnabled(options?.enabled, hasOptions),
    level: options?.level ?? LOGGING_DEFAULT_LEVEL,
  };
};

const shouldLog = (level: LogLevel, options: ResolvedLoggingOptions): boolean => {
  if (!options.enabled) {
    return false;
  }
  return LOGGING_LEVEL_WEIGHTS[level] <= LOGGING_LEVEL_WEIGHTS[options.level];
};

const mergeOptions = (local?: LoggingOptions): ResolvedLoggingOptions => {
  if (!local) {
    return globalOptions;
  }
  const resolvedLocal = resolveLoggingOptions(local);
  const level = local.level !== undefined ? resolvedLocal.level : globalOptions.level;
  return {
    enabled: resolvedLocal.enabled,
    level,
  };
};

const logWithMetadata = (
  level: LogLevel,
  scope: string,
  message: string,
  metadata: LogMetadata | undefined,
  options: ResolvedLoggingOptions
): void => {
  if (!shouldLog(level, options)) {
    return;
  }
  const metadataEntries = metadata ? Object.entries(metadata) : [];
  const logPayload: LoggerInfo = {
    level,
    message,
    [LOG_FIELD_LABEL]: scope,
  };
  if (metadataEntries.length > 0) {
    logPayload[LOG_FIELD_METADATA] = metadataEntries.reduce<LogMetadata>((accumulator, [key, value]) => {
      accumulator[key] = value;
      return accumulator;
    }, {});
  }
  baseLogger.log(logPayload);
};

export const configureLogging = (options?: LoggingOptions): ResolvedLoggingOptions => {
  globalOptions = resolveLoggingOptions(options);
  return globalOptions;
};

export class ScopedLogger {
  constructor(private readonly scope: string, private readonly localOptions?: LoggingOptions) {}

  public error(message: string, metadata?: LogMetadata): void {
    logWithMetadata(LogLevel.Error, this.scope, message, metadata, mergeOptions(this.localOptions));
  }

  public warn(message: string, metadata?: LogMetadata): void {
    logWithMetadata(LogLevel.Warn, this.scope, message, metadata, mergeOptions(this.localOptions));
  }

  public info(message: string, metadata?: LogMetadata): void {
    logWithMetadata(LogLevel.Info, this.scope, message, metadata, mergeOptions(this.localOptions));
  }

  public debug(message: string, metadata?: LogMetadata): void {
    logWithMetadata(LogLevel.Debug, this.scope, message, metadata, mergeOptions(this.localOptions));
  }
}

export const createScopedLogger = (scope: string, options?: LoggingOptions): ScopedLogger =>
  new ScopedLogger(scope, options);

export const getLoggingOptions = (): ResolvedLoggingOptions => ({ ...globalOptions });
