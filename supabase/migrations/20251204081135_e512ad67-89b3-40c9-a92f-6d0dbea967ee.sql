-- Update create_direct_conversation to skip friendship check for customer service accounts
CREATE OR REPLACE FUNCTION public.create_direct_conversation(friend_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_user_id uuid := auth.uid();
  target_friend_id uuid := friend_id;
  existing uuid;
  conv uuid;
  is_target_customer_service boolean;
begin
  if current_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- If a direct conversation already exists between the two users, return it
  select c.id into existing
  from public.conversations c
  join public.conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = current_user_id
  join public.conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = target_friend_id
  where c.type = 'direct'
  limit 1;

  if existing is not null then
    return existing;
  end if;

  -- Check if target is customer service account (skip friendship requirement)
  select is_customer_service into is_target_customer_service
  from public.profiles
  where id = target_friend_id;

  -- Only require friendship for non-customer-service accounts
  if not coalesce(is_target_customer_service, false) then
    if not exists (
      select 1 from public.friendships f
      where ((f.user_id = current_user_id and f.friend_id = target_friend_id)
          or (f.user_id = target_friend_id and f.friend_id = current_user_id))
        and f.status = 'accepted'
    ) then
      raise exception 'not friends' using errcode = '42501';
    end if;
  end if;

  -- Create conversation with creator = current user
  insert into public.conversations (type, created_by)
  values ('direct', current_user_id)
  returning id into conv;

  -- Add both participants
  insert into public.conversation_participants (conversation_id, user_id)
  values (conv, current_user_id);

  insert into public.conversation_participants (conversation_id, user_id)
  values (conv, target_friend_id);

  return conv;
end;
$function$;