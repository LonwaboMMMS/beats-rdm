-- Run once on an existing D1 database that already has the original users table.
ALTER TABLE users ADD COLUMN name TEXT;
