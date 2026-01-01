-- Add user_id column to profiles table for ALO ID format
ALTER TABLE public.profiles
ADD COLUMN user_id text UNIQUE;

-- Create function to generate ALO ID
CREATE OR REPLACE FUNCTION generate_alo_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id text;
  exists_count integer;
BEGIN
  LOOP
    -- Generate ALO + 7 random digits
    new_id := 'ALO' || lpad(floor(random() * 10000000)::text, 7, '0');
    
    -- Check if ID already exists
    SELECT COUNT(*) INTO exists_count FROM profiles WHERE user_id = new_id;
    
    -- Exit loop if unique
    IF exists_count = 0 THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN new_id;
END;
$$;

-- Create trigger to auto-generate ALO ID on insert
CREATE OR REPLACE FUNCTION set_user_alo_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := generate_alo_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_user_alo_id
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION set_user_alo_id();

-- Generate ALO IDs for existing users
UPDATE public.profiles
SET user_id = generate_alo_id()
WHERE user_id IS NULL;