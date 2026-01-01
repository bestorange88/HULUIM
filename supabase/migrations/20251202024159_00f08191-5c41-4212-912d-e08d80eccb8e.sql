-- Update handle_new_user function to properly save phone and invite_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  customer_service_id uuid;
  ai_assistant_id uuid;
BEGIN
    -- Create profile with phone and invite_code from metadata
    INSERT INTO public.profiles (
      id, 
      username, 
      display_name, 
      phone, 
      invite_code,
      referred_by_code
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'invite_code',
        NEW.raw_user_meta_data->>'referred_by_code'
    );
    
    -- Assign default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    -- Find customer service account by username
    SELECT id INTO customer_service_id
    FROM public.profiles
    WHERE username = 'customer_service'
    LIMIT 1;
    
    -- If customer service account exists and it's not the new user, create bidirectional friendship
    IF customer_service_id IS NOT NULL AND customer_service_id <> NEW.id THEN
        -- Add friendship from new user to customer service
        INSERT INTO public.friendships (user_id, friend_id, status)
        VALUES (NEW.id, customer_service_id, 'accepted')
        ON CONFLICT DO NOTHING;
        
        -- Add friendship from customer service to new user
        INSERT INTO public.friendships (user_id, friend_id, status)
        VALUES (customer_service_id, NEW.id, 'accepted')
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Find AI assistant account by username
    SELECT id INTO ai_assistant_id
    FROM public.profiles
    WHERE username = 'ai_assistant'
    LIMIT 1;
    
    -- If AI assistant account exists and it's not the new user, create bidirectional friendship
    IF ai_assistant_id IS NOT NULL AND ai_assistant_id <> NEW.id THEN
        -- Add friendship from new user to AI assistant
        INSERT INTO public.friendships (user_id, friend_id, status)
        VALUES (NEW.id, ai_assistant_id, 'accepted')
        ON CONFLICT DO NOTHING;
        
        -- Add friendship from AI assistant to new user
        INSERT INTO public.friendships (user_id, friend_id, status)
        VALUES (ai_assistant_id, NEW.id, 'accepted')
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$;