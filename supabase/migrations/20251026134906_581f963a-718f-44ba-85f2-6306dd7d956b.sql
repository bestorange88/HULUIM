-- Update existing pending friendship to accepted
UPDATE public.friendships 
SET status = 'accepted' 
WHERE user_id = 'a8bf3a87-6a0d-4419-999d-c0427986a1cc' 
AND friend_id = '11ac1b6d-66f1-4653-ac47-e1748ca14c14';

-- Add the reverse friendship if it doesn't exist
INSERT INTO public.friendships (user_id, friend_id, status)
SELECT '11ac1b6d-66f1-4653-ac47-e1748ca14c14', 'a8bf3a87-6a0d-4419-999d-c0427986a1cc', 'accepted'
WHERE NOT EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE user_id = '11ac1b6d-66f1-4653-ac47-e1748ca14c14' 
    AND friend_id = 'a8bf3a87-6a0d-4419-999d-c0427986a1cc'
);