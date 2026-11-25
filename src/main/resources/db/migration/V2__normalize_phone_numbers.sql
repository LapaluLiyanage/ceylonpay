-- Store every Sri Lankan mobile number in the single canonical form +947XXXXXXXX.
-- Rows whose canonical form would collide with an existing account are left untouched
-- (they need a manual merge decision, not a silent overwrite).
UPDATE users u
SET phone = '+94' || substr(u.phone, 2)
WHERE u.phone ~ '^07[0-9]{8}$'
  AND NOT EXISTS (
      SELECT 1 FROM users o WHERE o.phone = '+94' || substr(u.phone, 2)
  );
