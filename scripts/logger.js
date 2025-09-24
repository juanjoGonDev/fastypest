const { addColors, createLogger, format, transports } = require("winston");

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const LOG_COLORS = {
  error: "red",
  warn: "yellow",
  info: "cyan",
  debug: "magenta",
};
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

const formatMessage = (info) => {
  const label = info[LOG_FIELD_LABEL] ?? DEFAULT_SCOPE;
  const metadata = info[LOG_FIELD_METADATA];
  const metadataText = metadata && Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : "";
  return `${info.timestamp} [${label}] ${info.level}: ${info.message}${metadataText}`;
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
    baseLogger.log({
      level,
      message,
      [LOG_FIELD_LABEL]: scope,
      [LOG_FIELD_METADATA]: metadata ?? {},
    });
  };
  return {
    error: (message, metadata) => log("error", message, metadata),
    warn: (message, metadata) => log("warn", message, metadata),
    info: (message, metadata) => log("info", message, metadata),
    debug: (message, metadata) => log("debug", message, metadata),
  };
};

module.exports = { createScriptLogger };
