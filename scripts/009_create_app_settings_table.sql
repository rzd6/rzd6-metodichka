-- Create app_settings table to store key-value configuration like Yandex OAuth tokens
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Disable RLS so server-side API routes (anon key) can read/write freely
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
