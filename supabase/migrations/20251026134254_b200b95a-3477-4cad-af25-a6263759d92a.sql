-- Update handle_new_user to avoid self-friendship when creating the customer_service user
CREATE OR REPLACE FUNCTION public.handle_new_user()
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
    
    -- If customer service account exists and it's not the new user, create bidirectional friendship
    IF customer_service_id IS NOT NULL AND customer_service_id <> NEW.id THEN
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

-- Fix recursive RLS policy causing 500 on conversation_participants
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;

CREATE POLICY "Users can view their own participant rows"
ON public.conversation_participants
FOR SELECT
USING (auth.uid() = user_id);
