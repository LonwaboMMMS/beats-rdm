CREATE TABLE IF NOT EXISTS beat_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  beat_id TEXT NOT NULL,
  beat_title TEXT NOT NULL,
  producer TEXT NOT NULL DEFAULT '',
  artwork_url TEXT NOT NULL DEFAULT '',
  licence TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded','cancelled')),
  purchased_at INTEGER NOT NULL,
  UNIQUE(user_id, beat_id, licence)
);
CREATE INDEX IF NOT EXISTS beat_purchases_user_status_idx ON beat_purchases(user_id, payment_status);
CREATE TABLE IF NOT EXISTS beat_files (
  beat_id TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('preview','mp3','wav')),
  object_key TEXT NOT NULL,
  PRIMARY KEY (beat_id, format)
);