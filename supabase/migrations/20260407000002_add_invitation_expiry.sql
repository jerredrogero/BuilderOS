-- Add expires_at column to invitations for invitation expiry enforcement
ALTER TABLE invitations ADD COLUMN expires_at timestamptz;

-- Backfill existing sent invitations: set expires_at to 7 days after sent_at
UPDATE invitations
SET expires_at = sent_at + INTERVAL '7 days'
WHERE sent_at IS NOT NULL AND expires_at IS NULL;
