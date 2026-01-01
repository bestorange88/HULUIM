-- Update send function to support designated red envelopes
CREATE OR REPLACE FUNCTION public.send_red_envelope_with_balance(
  p_conversation_id uuid,
  p_amount numeric,
  p_quantity integer,
  p_type text,
  p_message text DEFAULT NULL,
  p_designated_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  current_user_id uuid := auth.uid();
  user_wallet record;
  new_balance numeric(10, 2);
  envelope_id uuid;
begin
  if current_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Get and lock wallet
  select * into user_wallet
  from public.wallets
  where user_id = current_user_id
  for update;

  if user_wallet is null then
    return jsonb_build_object('success', false, 'error', 'wallet_not_found');
  end if;

  -- Check balance
  if user_wallet.balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'insufficient_balance');
  end if;

  -- Create red envelope
  insert into public.red_envelopes (
    conversation_id, sender_id, amount, quantity,
    remaining_quantity, remaining_amount, type, message,
    expire_at, designated_user_id
  )
  values (
    p_conversation_id, current_user_id, p_amount, p_quantity,
    p_quantity, p_amount, p_type, p_message,
    now() + interval '24 hours', p_designated_user_id
  )
  returning id into envelope_id;

  -- Deduct balance
  new_balance := user_wallet.balance - p_amount;
  update public.wallets
  set balance = new_balance, updated_at = now()
  where user_id = current_user_id;

  -- Create transaction record
  insert into public.transactions (
    user_id, type, amount, balance_before, balance_after,
    description, reference_id, reference_type
  )
  values (
    current_user_id, 'red_envelope_send', p_amount,
    user_wallet.balance, new_balance,
    '发送红包', envelope_id, 'red_envelope'
  );

  return jsonb_build_object(
    'success', true,
    'envelope_id', envelope_id,
    'new_balance', new_balance
  );
end;
$$;