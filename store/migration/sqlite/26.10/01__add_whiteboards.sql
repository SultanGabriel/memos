CREATE TABLE whiteboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  title TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
  payload TEXT NOT NULL DEFAULT '{"tags":[]}',
  document TEXT NOT NULL DEFAULT '{}',
  thumbnail_attachment_id INTEGER DEFAULT NULL
);
CREATE INDEX idx_whiteboard_creator_state_updated ON whiteboard(creator_id, row_status, updated_ts DESC, id DESC);
CREATE INDEX idx_whiteboard_state_updated ON whiteboard(row_status, updated_ts DESC, id DESC);
