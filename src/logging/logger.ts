import { performance } from "node:perf_hooks";
import { addColors, createLogger, format, transports } from "winston";
import {
  LOGGING_COLORS,
  LOGGING_DEFAULT_ENABLED,
  LOGGING_DETAIL_LEVELS,
  LOGGING_LEVEL_ICONS,
  LOGGING_LEVEL_LABELS,
  LOGGING_LEVEL_WEIGHTS,
  LOGGING_TIMESTAMP_FORMAT,
  LogLevel,
  LoggingDetailLevel,
  type LoggingOptions,
  type ResolvedLoggingOptions,
} from "./constants";

const LOG_FIELD_LABEL = "label";
const LOG_FIELD_MESSAGE = "message";
const LOG_FIELD_LEVEL = "level";
const LOG_FIELD_TIMESTAMP = "timestamp";
const LOG_FIELD_DETAILS = "details";
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/g;
const DETAIL_SEPARATOR = " · ";
const DETAIL_PREFIX = " — ";
const MILLISECONDS_IN_SECOND = 1000;
const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const MILLISECONDS_IN_MINUTE = MILLISECONDS_IN_SECOND * SECONDS_IN_MINUTE;
const MILLISECONDS_IN_HOUR = MILLISECONDS_IN_MINUTE * MINUTES_IN_HOUR;
const DECIMAL_PRECISION_SHORT = 2;
const DECIMAL_PRECISION_LONG = 1;
const LOGGING_LEVELS_KEY: keyof LoggingOptions = "levels";
const LOGGING_DETAIL_KEY: keyof LoggingOptions = "detail";

const formatDetailValue = (detail: LogDetail): string | undefined => {
  if (detail === undefined) {
    return undefined;
  }
  if (detail === null) {
    return "null";
  }
  if (detail instanceof Date) {
    return detail.toISOString();
  }
  if (detail instanceof Error) {
    return detail.message;
  }
  if (typeof detail === "boolean") {
    return detail ? "yes" : "no";
  }
  return String(detail);
};

const trimDecimals = (value: number): string => {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toString();
};

const formatSeconds = (seconds: number): string => {
  const precision =
    seconds < 10 ? DECIMAL_PRECISION_SHORT : DECIMAL_PRECISION_LONG;
  const rounded = Number(seconds.toFixed(precision));
  return `${trimDecimals(rounded)}s`;
};

const formatDurationText = (durationMs: number): string => {
  if (durationMs <= 0) {
    return "0ms";
  }
  const segments: string[] = [];
  const hours = Math.floor(durationMs / MILLISECONDS_IN_HOUR);
  let remaining = durationMs - hours * MILLISECONDS_IN_HOUR;
  const minutes = Math.floor(remaining / MILLISECONDS_IN_MINUTE);
  remaining -= minutes * MILLISECONDS_IN_MINUTE;
  const seconds = remaining / MILLISECONDS_IN_SECOND;
  const wholeSeconds = Math.floor(seconds);
  const leftoverMs = Math.round(
    remaining - wholeSeconds * MILLISECONDS_IN_SECOND,
  );

  if (hours > 0) {
    segments.push(`${hours}h`);
  }
  if (minutes > 0) {
    segments.push(`${minutes}m`);
  }
  if (hours > 0 || minutes > 0) {
    if (wholeSeconds > 0) {
      segments.push(`${wholeSeconds}s`);
    }
    if (segments.length === 0 || leftoverMs > 0) {
      if (leftoverMs > 0) {
        segments.push(`${leftoverMs}ms`);
      }
    }
  } else if (seconds >= 1) {
    segments.push(formatSeconds(seconds));
  } else {
    segments.push(`${Math.round(durationMs)}ms`);
  }
  return segments.join(" ");
};

type LogDetail =
  | string
  | number
  | boolean
  | bigint
  | Date
  | Error
  | null
  | undefined;

type LogDetailsInput = LogDetail | LogDetail[];

type LoggerInfo = Record<string, unknown> & {
  level: string;
  message: string;
  [LOG_FIELD_DETAILS]?: string;
};

type LoggerPayload = LoggerInfo & {
  [LOG_FIELD_LABEL]: string;
};

type TimerEmitter = (
  level: LogLevel,
  message: string,
  details: LogDetail[],
) => void;

const extractLevel = (info: LoggerInfo): LogLevel | undefined => {
  const levelText = (info[LOG_FIELD_LEVEL] as string | undefined) ?? info.level;
  if (!levelText) {
    return undefined;
  }
  const normalized = levelText.replace(ANSI_ESCAPE_PATTERN, "").toLowerCase();
  return normalized in LOGGING_LEVEL_WEIGHTS
    ? (normalized as LogLevel)
    : undefined;
};

const formatDetails = (details: LogDetail[]): string | undefined => {
  const formatted = details
    .map((detail) => formatDetailValue(detail))
    .filter((value): value is string => Boolean(value && value.length > 0));
  if (formatted.length === 0) {
    return undefined;
  }
  return formatted.join(DETAIL_SEPARATOR);
};

const formatLogMessage = (info: LoggerInfo): string => {
  const label = info[LOG_FIELD_LABEL] as string | undefined;
  const timestamp = info[LOG_FIELD_TIMESTAMP] as string | undefined;
  const level = extractLevel(info);
  const fallbackLevel = info.level
    .replace(ANSI_ESCAPE_PATTERN, "")
    .toUpperCase();
  const message = info[LOG_FIELD_MESSAGE]
    ? String(info[LOG_FIELD_MESSAGE])
    : info.message;
  const levelLabel = level ? LOGGING_LEVEL_LABELS[level] : fallbackLevel;
  const levelIcon = level ? `${LOGGING_LEVEL_ICONS[level]} ` : "";
  const detailText = info[LOG_FIELD_DETAILS]
    ? String(info[LOG_FIELD_DETAILS])
    : "";
  const formattedDetails = detailText ? `${DETAIL_PREFIX}${detailText}` : "";
  const timestampText = timestamp ? `${timestamp} ` : "";
  return `${timestampText}${levelIcon}[${label ?? ""}] ${levelLabel} ${message}${formattedDetails}`;
};

addColors(LOGGING_COLORS);

const baseLogger = createLogger({
  levels: LOGGING_LEVEL_WEIGHTS,
  level: LogLevel.Verbose,
  format: format.combine(
    format.timestamp({ format: LOGGING_TIMESTAMP_FORMAT }),
    format.colorize({ all: true }),
    format.printf((info: unknown) => formatLogMessage(info as LoggerInfo)),
  ),
  transports: [new transports.Console()],
  silent: false,
});

let globalOptions: ResolvedLoggingOptions = {
  enabled: LOGGING_DEFAULT_ENABLED,
  levels: undefined,
  detail: undefined,
};

const resolveEnabled = (
  enabled: boolean | undefined,
  hasOptions: boolean,
): boolean => {
  if (enabled !== undefined) {
    return enabled;
  }
  if (hasOptions) {
    return true;
  }
  return LOGGING_DEFAULT_ENABLED;
};

const normalizeLevels = (levels?: LogLevel[]): LogLevel[] | undefined => {
  if (!levels || levels.length === 0) {
    return undefined;
  }
  const unique = Array.from(new Set(levels));
  return unique.length > 0 ? unique : undefined;
};

const hasLevelsOption = (options?: LoggingOptions): boolean => {
  if (!options) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(options, LOGGING_LEVELS_KEY);
};

const resolveLoggingOptions = (
  options?: LoggingOptions,
): ResolvedLoggingOptions => {
  const hasOptions = Boolean(options);
  const enabled = resolveEnabled(options?.enabled, hasOptions);
  if (!enabled) {
    return { enabled, levels: undefined, detail: undefined };
  }
  return {
    enabled,
    levels: normalizeLevels(options?.levels),
    detail: options?.detail,
  };
};

const getDetailLevels = (
  detail: LoggingDetailLevel | undefined,
): LogLevel[] | undefined => {
  if (!detail) {
    return undefined;
  }
  return LOGGING_DETAIL_LEVELS[detail];
};

const shouldLog = (
  level: LogLevel,
  options: ResolvedLoggingOptions,
): boolean => {
  if (!options.enabled) {
    return false;
  }
  const detailLevels = getDetailLevels(options.detail);
  const hasDetailFilter = detailLevels && detailLevels.length > 0;
  const hasLevelFilter = options.levels && options.levels.length > 0;
  if (!hasDetailFilter && !hasLevelFilter) {
    return true;
  }
  if (hasDetailFilter && !detailLevels!.includes(level)) {
    return false;
  }
  if (hasLevelFilter && !options.levels!.includes(level)) {
    return false;
  }
  return true;
};

const mergeOptions = (local?: LoggingOptions): ResolvedLoggingOptions => {
  if (!local) {
    return globalOptions;
  }
  const resolvedLocal = resolveLoggingOptions(local);
  const hasLocalLevels = hasLevelsOption(local);
  const hasLocalDetail = Object.prototype.hasOwnProperty.call(
    local,
    LOGGING_DETAIL_KEY,
  );
  const ignoreGlobalLevels = hasLocalDetail && !hasLocalLevels;
  return {
    enabled: resolvedLocal.enabled,
    levels: hasLocalLevels
      ? resolvedLocal.levels
      : ignoreGlobalLevels
        ? undefined
        : globalOptions.levels,
    detail: hasLocalDetail ? resolvedLocal.detail : globalOptions.detail,
  };
};

const normalizeDetails = (input: LogDetailsInput[]): LogDetail[] => {
  return input.flatMap((entry) => {
    if (Array.isArray(entry)) {
      return entry;
    }
    return [entry];
  });
};

const logWithDetails = (
  level: LogLevel,
  scope: string,
  message: string,
  details: LogDetail[],
  options: ResolvedLoggingOptions,
): void => {
  if (!shouldLog(level, options)) {
    return;
  }
  const formattedDetails = formatDetails(details);
  const logPayload: LoggerPayload = {
    level,
    message,
    [LOG_FIELD_LABEL]: scope,
  };
  if (formattedDetails) {
    logPayload[LOG_FIELD_DETAILS] = formattedDetails;
  }
  baseLogger.log(logPayload);
};

export const configureLogging = (
  options?: LoggingOptions,
): ResolvedLoggingOptions => {
  globalOptions = resolveLoggingOptions(options);
  return globalOptions;
};

class LoggerTimer {
  private readonly start = performance.now();
  private lastMark = this.start;
  private finished = false;

  constructor(
    private readonly label: string,
    private readonly emit: TimerEmitter,
  ) {}

  public mark(
    message: string,
    level: LogLevel = LogLevel.Debug,
    ...details: LogDetailsInput[]
  ): void {
    if (this.finished) {
      return;
    }
    const now = performance.now();
    const totalElapsed = now - this.start;
    const segmentElapsed = now - this.lastMark;
    this.lastMark = now;
    const timerDetails: LogDetail[] = [
      `${this.label} total ${formatDurationText(totalElapsed)}`,
    ];
    if (segmentElapsed > 0 && segmentElapsed !== totalElapsed) {
      timerDetails.push(`segment ${formatDurationText(segmentElapsed)}`);
    }
    const normalized = normalizeDetails(details);
    this.emit(level, message, [...timerDetails, ...normalized]);
  }

  public end(
    message?: string,
    level: LogLevel = LogLevel.Info,
    ...details: LogDetailsInput[]
  ): void {
    if (this.finished) {
      return;
    }
    const totalElapsed = performance.now() - this.start;
    const normalized = normalizeDetails(details);
    const timerDetails: LogDetail[] = [
      `${this.label} total ${formatDurationText(totalElapsed)}`,
    ];
    this.emit(level, message ?? `${this.label} completed`, [
      ...timerDetails,
      ...normalized,
    ]);
    this.finished = true;
  }
}

export class ScopedLogger {
  constructor(
    private readonly scope: string,
    private readonly localOptions?: LoggingOptions,
  ) {}

  public error(message: string, ...details: LogDetailsInput[]): void {
    this.write(LogLevel.Error, message, details);
  }

  public warn(message: string, ...details: LogDetailsInput[]): void {
    this.write(LogLevel.Warn, message, details);
  }

  public log(message: string, ...details: LogDetailsInput[]): void {
    this.write(LogLevel.Log, message, details);
  }

  public info(message: string, ...details: LogDetailsInput[]): void {
    this.write(LogLevel.Info, message, details);
  }

  public debug(message: string, ...details: LogDetailsInput[]): void {
    this.write(LogLevel.Debug, message, details);
  }

  public verbose(message: string, ...details: LogDetailsInput[]): void {
    this.write(LogLevel.Verbose, message, details);
  }

  public timer(label: string): LoggerTimer {
    return new LoggerTimer(label, (level, message, details) => {
      this.write(level, message, details);
    });
  }

  public formatDuration(durationMs: number): string {
    return formatDurationText(durationMs);
  }

  private write(
    level: LogLevel,
    message: string,
    details: LogDetailsInput[],
  ): void {
    const normalized = normalizeDetails(details);
    logWithDetails(
      level,
      this.scope,
      message,
      normalized,
      mergeOptions(this.localOptions),
    );
  }
}

export const createScopedLogger = (
  scope: string,
  options?: LoggingOptions,
): ScopedLogger => new ScopedLogger(scope, options);

export const getLoggingOptions = (): ResolvedLoggingOptions => ({
  ...globalOptions,
  levels: globalOptions.levels ? [...globalOptions.levels] : undefined,
});
