-- Avoid RLS infinite recursion by moving cross-table checks into SECURITY DEFINER helper functions
-- and recreating safe, non-recursive policies for conversations and conversation_participants.

-- 0) Ensure RLS is enabled (idempotent)
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- 1) Helper: check if a user is the creator of a conversation
create or replace function public.is_conversation_creator(
  _conversation_id uuid,
  _user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = _conversation_id
      and c.created_by = coalesce(_user_id, auth.uid())
  );
$$;

-- 2) Helper: check if a user is a member (creator or participant) of a conversation
create or replace function public.is_conversation_member(
  _conversation_id uuid,
  _user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_conversation_creator(_conversation_id, _user_id)
  or exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = _conversation_id
      and cp.user_id = coalesce(_user_id, auth.uid())
  );
$$;

-- 3) Grant execute on helpers to authenticated users
GRANT EXECUTE ON FUNCTION public.is_conversation_creator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;

-- 4) Drop potentially-recursive/old policies
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversations they participate in or created" ON public.conversations;

DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can join conversations (self or by creator)" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their own participant rows" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;

-- 5) Recreate safe, function-based policies
-- conversations: allow insert by creator only
CREATE POLICY conversations_insert_by_creator
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- conversations: allow select for members (creator or participant)
CREATE POLICY conversations_select_by_members
ON public.conversations
FOR SELECT
TO authenticated
USING (public.is_conversation_member(id, auth.uid()));

-- conversation_participants: allow insert by self or by conversation creator
CREATE POLICY participants_insert_by_self_or_creator
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_conversation_creator(conversation_id, auth.uid())
);

-- conversation_participants: allow select to members
CREATE POLICY participants_select_by_members
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));
