export enum LogLevel {
  Error = "error",
  Warn = "warn",
  Log = "notice",
  Info = "info",
  Debug = "debug",
  Verbose = "verbose",
}

export const LOGGING_DEFAULT_ENABLED = false;
export const LOGGING_DEFAULT_LEVEL = LogLevel.Log;
export const LOGGING_TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss";

export const LOGGING_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  [LogLevel.Error]: 0,
  [LogLevel.Warn]: 1,
  [LogLevel.Log]: 2,
  [LogLevel.Info]: 3,
  [LogLevel.Debug]: 4,
  [LogLevel.Verbose]: 5,
};

export const LOGGING_COLORS: Record<LogLevel, string> = {
  [LogLevel.Error]: "bold red",
  [LogLevel.Warn]: "bold yellow",
  [LogLevel.Log]: "bold green",
  [LogLevel.Info]: "bold cyan",
  [LogLevel.Debug]: "bold magenta",
  [LogLevel.Verbose]: "bold blue",
};

export const LOGGING_LEVEL_ICONS: Record<LogLevel, string> = {
  [LogLevel.Error]: "❌",
  [LogLevel.Warn]: "⚠️",
  [LogLevel.Log]: "🟢",
  [LogLevel.Info]: "💡",
  [LogLevel.Debug]: "🧭",
  [LogLevel.Verbose]: "🌀",
};

export const LOGGING_LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.Error]: "ERROR",
  [LogLevel.Warn]: "WARN",
  [LogLevel.Log]: "LOG",
  [LogLevel.Info]: "INFO",
  [LogLevel.Debug]: "DEBUG",
  [LogLevel.Verbose]: "VERBOSE",
};

export type LoggingOptions = {
  enabled?: boolean;
  level?: LogLevel;
};

export type ResolvedLoggingOptions = {
  enabled: boolean;
  level: LogLevel;
};
