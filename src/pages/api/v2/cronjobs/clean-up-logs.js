import { apiHandler } from '@/services/api-handler';
import { handleCron } from '@/lib/cron-guard';
import { runLogRetention } from '@/lib/log-retention';

// Hasura cron: log retention — lms_logs 7d, audit_logs 365d (noise actions 30d), user_activity_logs 90d, face_verify_attempts 30d.
// Archived tables are dumped to Spaces (gzipped NDJSON) before deletion; see lib/log-retention.js.
export default apiHandler({
    post: (req, res) => handleCron(
        req, res, 'clean-up-logs',
        () => runLogRetention({ scheduledTime: req.body?.scheduled_time }),
        { background: true, staleMinutes: 60, message: 'done clean up logs in background' }
    ),
});
