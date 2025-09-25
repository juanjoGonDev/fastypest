const { addColors, createLogger, format, transports } = require("winston");

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  notice: 2,
  info: 3,
  debug: 4,
  verbose: 5,
};

const LOG_COLORS = {
  error: "bold red",
  warn: "bold yellow",
  notice: "bold green",
  info: "bold cyan",
  debug: "bold magenta",
  verbose: "bold blue",
};

const LOG_LEVEL_ICONS = {
  error: "❌",
  warn: "⚠️",
  notice: "🟢",
  info: "💡",
  debug: "🧭",
  verbose: "🌀",
};

const LOG_LEVEL_LABELS = {
  error: "ERROR",
  warn: "WARN",
  notice: "LOG",
  info: "INFO",
  debug: "DEBUG",
  verbose: "VERBOSE",
};

const LOG_TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss";
const LOG_FIELD_LABEL = "label";
const LOG_FIELD_MESSAGE = "message";
const LOG_FIELD_LEVEL = "level";
const LOG_FIELD_TIMESTAMP = "timestamp";
const LOG_FIELD_DETAILS = "details";
const DETAIL_SEPARATOR = " · ";
const DETAIL_PREFIX = " — ";
const DEFAULT_LEVEL = "notice";
const DEFAULT_ENABLED = true;

addColors(LOG_COLORS);

const formatDetailValue = (detail) => {
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

const formatDetails = (details = []) => {
  const formatted = details
    .map((detail) => formatDetailValue(detail))
    .filter((value) => Boolean(value && value.length > 0));
  if (formatted.length === 0) {
    return undefined;
  }
  return formatted.join(DETAIL_SEPARATOR);
};

const formatMessage = (info) => {
  const label = info[LOG_FIELD_LABEL];
  const level = info[LOG_FIELD_LEVEL];
  const timestamp = info[LOG_FIELD_TIMESTAMP];
  const levelLabel = LOG_LEVEL_LABELS[level] ?? String(level ?? "");
  const levelIcon = LOG_LEVEL_ICONS[level] ? `${LOG_LEVEL_ICONS[level]} ` : "";
  const detailsText = info[LOG_FIELD_DETAILS]
    ? `${DETAIL_PREFIX}${String(info[LOG_FIELD_DETAILS])}`
    : "";
  const timestampText = timestamp ? `${timestamp} ` : "";
  return `${timestampText}${levelIcon}[${label ?? ""}] ${levelLabel} ${info[LOG_FIELD_MESSAGE]}${detailsText}`;
};

const baseLogger = createLogger({
  levels: LOG_LEVELS,
  level: "verbose",
  format: format.combine(
    format.timestamp({ format: LOG_TIMESTAMP_FORMAT }),
    format.colorize({ all: true }),
    format.printf((info) => formatMessage(info))
  ),
  transports: [new transports.Console()],
  silent: false,
});

const mergeOptions = (options = {}) => ({
  enabled: options.enabled ?? DEFAULT_ENABLED,
  level: options.level ?? DEFAULT_LEVEL,
});

const normalizeDetails = (details) => {
  if (!details) {
    return [];
  }
  return details.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]));
};

const createScriptLogger = (scope, options = {}) => {
  const configuration = mergeOptions(options);
  const log = (level, message, details = []) => {
    if (!configuration.enabled) {
      return;
    }
    baseLogger.level = configuration.level;
    const detailText = formatDetails(normalizeDetails(details));
    const payload = {
      level,
      message,
      [LOG_FIELD_LABEL]: scope,
    };
    if (detailText) {
      payload[LOG_FIELD_DETAILS] = detailText;
    }
    baseLogger.log(payload);
  };
  return {
    error: (message, ...details) => log("error", message, details),
    warn: (message, ...details) => log("warn", message, details),
    log: (message, ...details) => log("notice", message, details),
    info: (message, ...details) => log("info", message, details),
    debug: (message, ...details) => log("debug", message, details),
    verbose: (message, ...details) => log("verbose", message, details),
  };
};

module.exports = { createScriptLogger };
