-- Fix update_group_member_role to check conversations.created_by for ownership
CREATE OR REPLACE FUNCTION public.update_group_member_role(_conversation_id uuid, _target_user_id uuid, _new_role group_member_role)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  is_owner BOOLEAN;
  target_role group_member_role;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Check if current user is the owner (by checking created_by)
  SELECT EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = _conversation_id AND created_by = current_user_id
  ) INTO is_owner;

  IF NOT is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Get target user's current role
  SELECT role INTO target_role
  FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = _target_user_id;

  IF target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_not_member');
  END IF;

  -- Cannot change if target is also the owner
  IF _target_user_id = current_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_change_owner');
  END IF;

  -- Update role
  UPDATE conversation_participants
  SET role = _new_role
  WHERE conversation_id = _conversation_id AND user_id = _target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;