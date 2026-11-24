CREATE TABLE IF NOT EXISTS beats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  producer TEXT NOT NULL,
  genre TEXT NOT NULL,
  bpm INTEGER,
  musical_key TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price_mp3 INTEGER NOT NULL DEFAULT 0,
  price_wav INTEGER NOT NULL DEFAULT 0,
  price_exclusive INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','sold')),
  artwork_key TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS beats_status_created_idx ON beats(status, created_at DESC);
