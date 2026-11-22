-- Add an administrator role to existing Reverb Beats accounts.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS users_is_admin_idx ON users(is_admin);
