CREATE TABLE whiteboard (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  row_status TEXT NOT NULL DEFAULT 'NORMAL',
  title TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
  payload JSONB NOT NULL DEFAULT '{"tags":[]}',
  document JSONB NOT NULL DEFAULT '{}',
  thumbnail_attachment_id INTEGER DEFAULT NULL
);
CREATE INDEX idx_whiteboard_creator_state_updated ON whiteboard(creator_id, row_status, updated_ts DESC, id DESC);
CREATE INDEX idx_whiteboard_state_updated ON whiteboard(row_status, updated_ts DESC, id DESC);
