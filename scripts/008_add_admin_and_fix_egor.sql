-- Fix Egor_Washington position to a valid position without prefix
UPDATE users
SET position = 'Начальник Депо', full_name = '[Руководство] Egor_Washington'
WHERE username = 'Egor_Washington';

-- Insert Egor_Washington if not exists
INSERT INTO users (username, password, full_name, position, rank, avatar)
VALUES (
  'Egor_Washington',
  '123',
  '[Руководство] Egor_Washington',
  'Начальник Депо',
  9,
  '/avatars/management.png'
)
ON CONFLICT (username) DO UPDATE SET
  position = 'Начальник Депо',
  rank = 9,
  full_name = '[Руководство] Egor_Washington';

-- Insert Admin user if not exists
-- Admin has role Руководство (via position ГСЗФ) and will be auto-deleted
-- once a real Руководство user is added through the app
INSERT INTO users (username, password, full_name, position, rank, avatar)
VALUES (
  'Admin',
  '123',
  '[Руководство] Admin',
  'ГСЗФ',
  9,
  '/avatars/management.png'
)
ON CONFLICT (username) DO NOTHING;
