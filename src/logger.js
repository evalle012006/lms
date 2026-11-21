import  *  as  winston  from  'winston';
const { format } = require("winston");
const Transport = require('winston-transport');
import  'winston-daily-rotate-file';
import { GraphProvider } from './lib/graph/graph.provider';
import { createGraphType, insertQl } from './lib/graph/graph.util';
import { shouldPersistLog } from './lib/log-filter';
const { combine, timestamp, label, prettyPrint } = format;

const graph = new GraphProvider();
const LMS_LOG_TYPE = createGraphType('lms_logs', `id`)('logs');

const isString = value => typeof value === 'string' || value instanceof String;

// DB persistence policy: warn/error entries, plus any entry that carries a user_id
// (business events are logged at debug level with user_id). Everything else stays in the rotating files.
const DB_FLUSH_MS = 2000;
const DB_FLUSH_MAX = 50;
const DB_BUFFER_CAP = 1000;

class DBLoggerTransport extends Transport {
  constructor(opts) {
    super(opts);
    this.buffer = [];
    this.timer = null;
    this.flushing = false;
  }

  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.flushing || this.buffer.length === 0) return;
    const objects = this.buffer.splice(0, DB_FLUSH_MAX);
    this.flushing = true;
    graph.mutation(insertQl(LMS_LOG_TYPE, { objects }))
      .catch(() => { /* never let a failed log write break the request (and never log from here: recursion) */ })
      .finally(() => {
        this.flushing = false;
        if (this.buffer.length) this.schedule(true);
      });
  }

  schedule(immediate) {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), immediate ? 0 : DB_FLUSH_MS);
    if (this.timer.unref) this.timer.unref();
  }

  log(info, callback) {
    if (process.env.ENABLE_DB_LOGGING === 'true' && shouldPersistLog(info)) {
      let log_info = { ...info };
      const { message } = log_info;
      if (!!message && !isString(message)) {
        log_info = { ...info, ...message };
        delete log_info.message;
      }
      if (this.buffer.length < DB_BUFFER_CAP) {
        this.buffer.push({ info: log_info, user_id: log_info.user_id ?? log_info.userId ?? null });
        if (this.buffer.length >= DB_FLUSH_MAX) this.flush(); else this.schedule(false);
      }
    }
    callback();
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

var dbLogger = new DBLoggerTransport({ level: 'debug' });

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