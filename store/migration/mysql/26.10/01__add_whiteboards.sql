CREATE TABLE whiteboard (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE,
  creator_id INT NOT NULL,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_status VARCHAR(256) NOT NULL DEFAULT 'NORMAL',
  title TEXT NOT NULL,
  payload JSON NOT NULL,
  document JSON NOT NULL,
  thumbnail_attachment_id INT DEFAULT NULL
);
CREATE INDEX idx_whiteboard_creator_state_updated ON whiteboard(creator_id, row_status, updated_ts DESC, id DESC);
CREATE INDEX idx_whiteboard_state_updated ON whiteboard(row_status, updated_ts DESC, id DESC);
