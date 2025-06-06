import  *  as  winston  from  'winston';
const { format } = require("winston");
const Transport = require('winston-transport');
import  'winston-daily-rotate-file';
import { GraphProvider } from './lib/graph/graph.provider';
import { createGraphType, insertQl } from './lib/graph/graph.util';
const { combine, timestamp, label, prettyPrint } = format;

const graph = new GraphProvider();
const LMS_LOG_TYPE = createGraphType('lms_logs', `id`)('logs');

const isString = value => typeof value === 'string' || value instanceof String;

class DBLoggerTransport extends Transport {
  constructor(opts) {
    super(opts);
    //
    // Consume any custom options here. e.g.:
    // - Connection information for databases
    // - Authentication information for APIs (e.g. loggly, papertrail, 
    //   logentries, etc.).
    //
  }

  log(info, callback) {
    let log_info = { ... info };
    const { message } = log_info;
    if(!!message && !isString(message)) {
      log_info = { 
        ... info,
        ... message
      }
      delete log_info.message;
    }

    if(process.env.ENABLE_DB_LOGGING === 'true') {
      const { user_id } = log_info;
      graph.mutation(insertQl(LMS_LOG_TYPE, { objects: [{ info: log_info, user_id: user_id ?? null }] }))
      .finally(() => {
        callback();
      })
    } else {
      callback();
    }
  }
};

const logs = new winston.transports.DailyRotateFile({
  filename: './logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '7d'
});

var errors = new winston.transports.DailyRotateFile({
  level: 'error',
  filename: './logs/application-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

logs.on('rotate', function(oldFilename, newFilename) {
  // do something fun
});

var dbLogger = new DBLoggerTransport();

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
    errors,
    dbLogger,
  ]
});

export default logger;