-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated function that adds customer service as default friend
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  customer_service_id uuid;
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
    );
    
    -- Assign default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    -- Find customer service account by username
    SELECT id INTO customer_service_id
    FROM public.profiles
    WHERE username = 'customer_service'
    LIMIT 1;
    
    -- If customer service account exists, create bidirectional friendship
    IF customer_service_id IS NOT NULL THEN
        -- Add friendship from new user to customer service
        INSERT INTO public.friendships (user_id, friend_id, status)
        VALUES (NEW.id, customer_service_id, 'accepted');
        
        -- Add friendship from customer service to new user
        INSERT INTO public.friendships (user_id, friend_id, status)
        VALUES (customer_service_id, NEW.id, 'accepted');
    END IF;
    
    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();