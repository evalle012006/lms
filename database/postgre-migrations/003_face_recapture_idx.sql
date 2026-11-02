CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_client_ts ON audit_logs ("clientId", "timestamp" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity ON audit_logs ("entityId");