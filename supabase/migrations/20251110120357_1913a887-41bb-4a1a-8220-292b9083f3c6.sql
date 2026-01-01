-- RPC: create group conversation securely
create or replace function public.create_group_conversation(name text, participant_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  conv uuid;
  pid uuid;
begin
  if current_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if participant_ids is null or array_length(participant_ids, 1) is null then
    raise exception 'no participants' using errcode = '23514';
  end if;

  -- Create the group conversation
  insert into public.conversations (type, name, created_by)
  values ('group', nullif(name, ''), current_user_id)
  returning id into conv;

  -- Add creator
  insert into public.conversation_participants (conversation_id, user_id)
  values (conv, current_user_id);

  -- Add distinct other participants, skipping creator
  foreach pid in array participant_ids loop
    if pid is not null and pid <> current_user_id then
      insert into public.conversation_participants (conversation_id, user_id)
      values (conv, pid)
      on conflict do nothing;
    end if;
  end loop;

  return conv;
end;
$$;

grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;