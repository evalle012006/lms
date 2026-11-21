// Which log entries are persisted to lms_logs: warn/error, plus any entry carrying a user_id
// (business events are logged at debug level with user_id). Everything else stays in the rotating files.
export const shouldPersistLog = (info) => {
  if (!info) return false;
  if (info.level === 'warn' || info.level === 'error') return true;
  const m = info.message;
  const inner = m && typeof m === 'object' ? m : {};
  return !!(info.user_id ?? info.userId ?? inner.user_id ?? inner.userId);
};
