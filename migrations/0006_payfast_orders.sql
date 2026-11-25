CREATE TABLE IF NOT EXISTS beat_orders (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled','failed')),
  pf_payment_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX IF NOT EXISTS beat_orders_user_created_idx ON beat_orders(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS beat_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES beat_orders(id) ON DELETE CASCADE,
  beat_id TEXT NOT NULL,
  beat_title TEXT NOT NULL,
  producer TEXT NOT NULL DEFAULT '',
  artwork_url TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL CHECK (format IN ('mp3','wav')),
  licence TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL
);
ALTER TABLE beat_purchases ADD COLUMN format TEXT NOT NULL DEFAULT 'mp3';
ALTER TABLE beat_purchases ADD COLUMN order_id TEXT;
CREATE INDEX IF NOT EXISTS beat_purchases_order_idx ON beat_purchases(order_id);
