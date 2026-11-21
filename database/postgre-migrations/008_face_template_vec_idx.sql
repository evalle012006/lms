-- 008_face_template_vec_idx.sql — run AFTER 007, on its own (CREATE INDEX CONCURRENTLY cannot run in a transaction).
-- Same name and parameters as the index already on staging (client_face_template_hnsw, m=16, ef_construction=64),
-- so on staging this is a no-op and on production it builds the same index without locking writes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS client_face_template_hnsw
  ON client USING hnsw ("faceTemplateVec" vector_l2_ops) WITH (m = 16, ef_construction = 64);
