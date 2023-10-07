import  *  as  winston  from  'winston';
const { format } = require("winston");
import  'winston-daily-rotate-file';
const { combine, timestamp, label, prettyPrint } = format;

const logs = new winston.transports.DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '7d'
});

var errors = new winston.transports.DailyRotateFile({
  level: 'error',
  filename: 'logs/application-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

logs.on('rotate', function(oldFilename, newFilename) {
  // do something fun
});

const logger = winston.createLogger({
  level: "debug",
  format: combine(
    label({ label: 'Lending Managment System Logs' }),
    timestamp({
      format: "MMM-DD-YYYY HH:mm:ss",
    }),
    prettyPrint()
  ),
  transports: [
    logs,
    errors
  ]
});

export default logger;