-- Bug reports table for the management section
CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_nickname text NOT NULL,
  sender_role text NOT NULL,
  sender_position text NOT NULL,
  from_section text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);