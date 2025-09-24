const { addColors, createLogger, format, transports } = require("winston");

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const LOG_COLORS = {
  error: "bold red",
  warn: "bold yellow",
  info: "bold green",
  debug: "bold cyan",
};
const LOG_LEVEL_ICONS = {
  error: "❌",
  warn: "⚠️",
  info: "ℹ️",
  debug: "🔍",
};
const LOG_LEVEL_LABELS = {
  error: "ERROR",
  warn: "WARN",
  info: "INFO",
  debug: "DEBUG",
};
const LOG_METADATA_SEPARATOR = " | ";
const LOG_METADATA_KEY_VALUE_SEPARATOR = ": ";
const LOG_TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss";
const LOG_FIELD_LABEL = "label";
const LOG_FIELD_METADATA = "metadata";
const LOG_FIELD_MESSAGE = "message";
const LOG_FIELD_LEVEL = "level";
const LOG_FIELD_TIMESTAMP = "timestamp";
const DEFAULT_SCOPE = "Script";
const DEFAULT_LEVEL = "info";
const DEFAULT_ENABLED = true;

addColors(LOG_COLORS);

const baseLogger = createLogger({
  levels: LOG_LEVELS,
  level: DEFAULT_LEVEL,
  format: format.combine(
    format.timestamp({ format: LOG_TIMESTAMP_FORMAT }),
    format.metadata({
      fillExcept: [LOG_FIELD_MESSAGE, LOG_FIELD_LEVEL, LOG_FIELD_TIMESTAMP, LOG_FIELD_LABEL],
    }),
    format.colorize({ all: true }),
    format.printf((info) => formatMessage(info))
  ),
  transports: [new transports.Console()],
  silent: false,
});

const formatValue = (value) => {
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

const formatMetadata = (metadata) => {
  if (!metadata) {
    return "";
  }
  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return "";
  }
  return entries
    .map(([key, value]) => `${key}${LOG_METADATA_KEY_VALUE_SEPARATOR}${formatValue(value)}`)
    .join(LOG_METADATA_SEPARATOR);
};

const formatMessage = (info) => {
  const label = info[LOG_FIELD_LABEL] ?? DEFAULT_SCOPE;
  const metadata = info[LOG_FIELD_METADATA];
  const level = info[LOG_FIELD_LEVEL];
  const levelLabel = LOG_LEVEL_LABELS[level] ?? String(level ?? "");
  const levelIcon = LOG_LEVEL_ICONS[level] ? `${LOG_LEVEL_ICONS[level]} ` : "";
  const metadataText = formatMetadata(metadata);
  const formattedMetadata = metadataText ? `${LOG_METADATA_SEPARATOR}${metadataText}` : "";
  return `${info.timestamp} ${levelIcon}[${label}] ${levelLabel} ${info.message}${formattedMetadata}`;
};

const mergeOptions = (options = {}) => ({
  enabled: options.enabled ?? DEFAULT_ENABLED,
  level: options.level ?? DEFAULT_LEVEL,
});

const createScriptLogger = (scope = DEFAULT_SCOPE, options = {}) => {
  const configuration = mergeOptions(options);
  const log = (level, message, metadata) => {
    if (!configuration.enabled) {
      return;
    }
    baseLogger.level = configuration.level;
    const metadataEntries = metadata ? Object.entries(metadata) : [];
    const payload = {
      level,
      message,
      [LOG_FIELD_LABEL]: scope,
    };
    if (metadataEntries.length > 0) {
      payload[LOG_FIELD_METADATA] = metadataEntries.reduce((accumulator, [key, value]) => {
        accumulator[key] = value;
        return accumulator;
      }, {});
    }
    baseLogger.log(payload);
  };
  return {
    error: (message, metadata) => log("error", message, metadata),
    warn: (message, metadata) => log("warn", message, metadata),
    info: (message, metadata) => log("info", message, metadata),
    debug: (message, metadata) => log("debug", message, metadata),
  };
};

module.exports = { createScriptLogger };
