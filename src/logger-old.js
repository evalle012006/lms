const { createLogger, transports, format } = require("winston");
const { combine, timestamp, label, prettyPrint } = format;

const logger = createLogger({
  level: "debug",
  format: combine(
    label({ label: 'Lending Managment System Logs' }),
    timestamp({
      format: "MMM-DD-YYYY HH:mm:ss",
    }),
    prettyPrint()
  ),
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