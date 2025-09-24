export enum LogLevel {
  Error = "error",
  Warn = "warn",
  Info = "info",
  Debug = "debug",
}

export const LOGGING_DEFAULT_ENABLED = false;
export const LOGGING_DEFAULT_LEVEL = LogLevel.Info;
export const LOGGING_TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss";
export const LOGGING_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  [LogLevel.Error]: 0,
  [LogLevel.Warn]: 1,
  [LogLevel.Info]: 2,
  [LogLevel.Debug]: 3,
};
export const LOGGING_COLORS: Record<LogLevel, string> = {
  [LogLevel.Error]: "bold red",
  [LogLevel.Warn]: "bold yellow",
  [LogLevel.Info]: "bold green",
  [LogLevel.Debug]: "bold cyan",
};
export const LOGGING_LEVEL_ICONS: Record<LogLevel, string> = {
  [LogLevel.Error]: "❌",
  [LogLevel.Warn]: "⚠️",
  [LogLevel.Info]: "ℹ️",
  [LogLevel.Debug]: "🔍",
};
export const LOGGING_LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.Error]: "ERROR",
  [LogLevel.Warn]: "WARN",
  [LogLevel.Info]: "INFO",
  [LogLevel.Debug]: "DEBUG",
};
export const LOGGING_METADATA_SEPARATOR = " | ";
export const LOGGING_METADATA_KEY_VALUE_SEPARATOR = ": ";
export const LOGGING_DEFAULT_SCOPE = "Fastypest";

export type LoggingOptions = {
  enabled?: boolean;
  level?: LogLevel;
};

export type ResolvedLoggingOptions = {
  enabled: boolean;
  level: LogLevel;
};
