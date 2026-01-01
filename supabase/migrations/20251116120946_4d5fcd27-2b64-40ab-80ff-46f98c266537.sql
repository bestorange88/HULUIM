-- Update mark_messages_as_read function to also update last_read_at in conversation_participants
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_conversation_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update messages status
  UPDATE public.messages
  SET 
    status = 'read',
    read_by = CASE 
      WHEN read_by ? p_user_id::text THEN read_by
      ELSE jsonb_set(read_by, array[jsonb_array_length(read_by)::text], to_jsonb(p_user_id::text))
    END,
    updated_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND status = 'sent';
  
  -- Update last_read_at in conversation_participants
  UPDATE public.conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
END;
$$;