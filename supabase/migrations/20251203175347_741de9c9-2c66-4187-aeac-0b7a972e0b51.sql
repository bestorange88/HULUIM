-- Fix remove_group_member function to properly check ownership via conversations.created_by
CREATE OR REPLACE FUNCTION public.remove_group_member(_conversation_id uuid, _target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  is_owner BOOLEAN;
  current_role group_member_role;
  target_role group_member_role;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Check if current user is the owner via conversations.created_by
  SELECT EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = _conversation_id AND created_by = current_user_id
  ) INTO is_owner;

  -- Get current user's role from participants (for admin check)
  SELECT role INTO current_role
  FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = current_user_id;

  IF current_role IS NULL AND NOT is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_member');
  END IF;

  -- Get target user's role
  SELECT role INTO target_role
  FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = _target_user_id;

  IF target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_not_member');
  END IF;

  -- Owner can remove anyone except themselves
  -- Admin can remove members only
  IF is_owner THEN
    IF _target_user_id = current_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'owner_cannot_leave');
    END IF;
  ELSIF current_role = 'admin' THEN
    IF target_role IN ('owner', 'admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Remove member
  DELETE FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = _target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;