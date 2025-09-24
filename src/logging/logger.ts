import { addColors, createLogger, format, transports } from "winston";
import {
  LOGGING_COLORS,
  LOGGING_DEFAULT_ENABLED,
  LOGGING_DEFAULT_LEVEL,
  LOGGING_LEVEL_WEIGHTS,
  LOGGING_TIMESTAMP_FORMAT,
  LogLevel,
  type LoggingOptions,
  type ResolvedLoggingOptions,
} from "./constants";

type LogMetadata = Record<string, unknown>;
type LoggerInfo = Record<string, unknown>;

const LOG_FIELD_LABEL = "label";
const LOG_FIELD_METADATA = "metadata";
const LOG_FIELD_MESSAGE = "message";
const LOG_FIELD_LEVEL = "level";
const LOG_FIELD_TIMESTAMP = "timestamp";
const LOGGER_SCOPE_DEFAULT = "Fastypest";

const formatLogMessage = (info: LoggerInfo): string => {
  const label = info[LOG_FIELD_LABEL] as string | undefined;
  const metadata = info[LOG_FIELD_METADATA] as LogMetadata | undefined;
  const metadataText = metadata && Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : "";
  const timestamp = info[LOG_FIELD_TIMESTAMP] as string | undefined;
  const level = String(info[LOG_FIELD_LEVEL] ?? "");
  const message = String(info[LOG_FIELD_MESSAGE] ?? "");
  const timestampText = timestamp ? `${timestamp} ` : "";
  return `${timestampText}[${label ?? LOGGER_SCOPE_DEFAULT}] ${level}: ${message}${metadataText}`;
};

addColors(LOGGING_COLORS);

const baseLogger = createLogger({
  levels: LOGGING_LEVEL_WEIGHTS,
  level: LogLevel.Debug,
  format: format.combine(
    format.timestamp({ format: LOGGING_TIMESTAMP_FORMAT }),
    format.metadata({ fillExcept: [LOG_FIELD_MESSAGE, LOG_FIELD_LEVEL, LOG_FIELD_TIMESTAMP, LOG_FIELD_LABEL] }),
    format.colorize({ all: true }),
    format.printf((info) => formatLogMessage(info as LoggerInfo))
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
  baseLogger.log({
    level,
    message,
    [LOG_FIELD_LABEL]: scope,
    [LOG_FIELD_METADATA]: metadata ?? {},
  });
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
