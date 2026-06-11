CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  quantity TEXT NOT NULL,
  person TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
