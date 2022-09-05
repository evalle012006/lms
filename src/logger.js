const { createLogger, transports, format } = require("winston");

const logger = createLogger({
  level: "debug",
  format: format.json(),
  transports: [
    new transports.File({
      filename: "logs/logs.log",
    }),
    new transports.File({
      level: "error",
      filename: "logs/error.log",
    }),
    new transports.Console(),
  ],
});

module.exports = logger;