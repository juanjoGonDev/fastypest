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
  [LogLevel.Error]: "red",
  [LogLevel.Warn]: "yellow",
  [LogLevel.Info]: "cyan",
  [LogLevel.Debug]: "magenta",
};

export type LoggingOptions = {
  enabled?: boolean;
  level?: LogLevel;
};

export type ResolvedLoggingOptions = {
  enabled: boolean;
  level: LogLevel;
};
