-- Backfill phone and invite_code for existing users from auth.users metadata
UPDATE public.profiles p
SET 
  phone = COALESCE(p.phone, au.raw_user_meta_data->>'phone'),
  invite_code = COALESCE(p.invite_code, au.raw_user_meta_data->>'invite_code')
FROM auth.users au
WHERE p.id = au.id
  AND (p.phone IS NULL OR p.invite_code IS NULL)
  AND (au.raw_user_meta_data->>'phone' IS NOT NULL OR au.raw_user_meta_data->>'invite_code' IS NOT NULL);

-- Generate invite codes for users who still don't have one
DO $$
DECLARE
  user_record RECORD;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  FOR user_record IN 
    SELECT id FROM public.profiles WHERE invite_code IS NULL OR invite_code = ''
  LOOP
    -- Generate unique invite code
    LOOP
      new_code := '';
      FOR i IN 1..8 LOOP
        new_code := new_code || SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 
          FLOOR(RANDOM() * 36 + 1)::INTEGER, 1);
      END LOOP;
      
      -- Check if code already exists
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE invite_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    
    -- Update user with new invite code
    UPDATE public.profiles SET invite_code = new_code WHERE id = user_record.id;
  END LOOP;
END $$;