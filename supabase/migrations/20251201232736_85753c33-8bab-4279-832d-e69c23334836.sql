-- Add function to transfer group ownership
CREATE OR REPLACE FUNCTION public.transfer_group_ownership(
  _conversation_id UUID,
  _new_owner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_role group_member_role;
  target_role group_member_role;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get current user's role
  SELECT role INTO current_role
  FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = current_user_id;

  IF current_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_member');
  END IF;

  -- Only owner can transfer ownership
  IF current_role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Get target user's role
  SELECT role INTO target_role
  FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = _new_owner_id;

  IF target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_not_member');
  END IF;

  -- Transfer ownership: demote current owner to admin, promote target to owner
  UPDATE conversation_participants
  SET role = 'admin'
  WHERE conversation_id = _conversation_id AND user_id = current_user_id;

  UPDATE conversation_participants
  SET role = 'owner'
  WHERE conversation_id = _conversation_id AND user_id = _new_owner_id;

  -- Update conversation created_by
  UPDATE conversations
  SET created_by = _new_owner_id
  WHERE id = _conversation_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Add function to dissolve group
CREATE OR REPLACE FUNCTION public.dissolve_group(_conversation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_role group_member_role;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get current user's role
  SELECT role INTO current_role
  FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = current_user_id;

  IF current_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_member');
  END IF;

  -- Only owner can dissolve group
  IF current_role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Delete all participants
  DELETE FROM conversation_participants WHERE conversation_id = _conversation_id;

  -- Delete all invites
  DELETE FROM group_invites WHERE conversation_id = _conversation_id;

  -- Delete all messages (or keep them for archive)
  DELETE FROM messages WHERE conversation_id = _conversation_id;

  -- Delete the conversation
  DELETE FROM conversations WHERE id = _conversation_id;

  RETURN jsonb_build_object('success', true);
END;
$$;