-- Function to generate unique 5-character invite code
CREATE OR REPLACE FUNCTION generate_short_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
  exists_count INTEGER;
BEGIN
  LOOP
    new_code := '';
    FOR i IN 1..5 LOOP
      new_code := new_code || substr(chars, floor(random() * 36 + 1)::int, 1);
    END LOOP;
    
    -- Check if code already exists
    SELECT COUNT(*) INTO exists_count FROM profiles WHERE invite_code = new_code;
    
    IF exists_count = 0 THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- Update all existing invite codes to 5-character format
DO $$
DECLARE
  profile_record RECORD;
  new_code TEXT;
BEGIN
  FOR profile_record IN SELECT id FROM profiles WHERE invite_code IS NOT NULL AND length(invite_code) != 5
  LOOP
    new_code := generate_short_invite_code();
    UPDATE profiles SET invite_code = new_code WHERE id = profile_record.id;
  END LOOP;
END;
$$;