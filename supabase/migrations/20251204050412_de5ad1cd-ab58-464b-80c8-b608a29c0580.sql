-- Add designated_user_id column to red_envelopes table
ALTER TABLE public.red_envelopes 
ADD COLUMN designated_user_id uuid REFERENCES public.profiles(id);

-- Update the claim function to handle designated red envelopes
CREATE OR REPLACE FUNCTION public.claim_red_envelope_with_balance(envelope_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  current_user_id uuid := auth.uid();
  envelope_record record;
  claim_amount numeric(10, 2);
  user_wallet record;
  new_balance numeric(10, 2);
  transaction_id uuid;
begin
  if current_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Lock and get envelope
  select * into envelope_record
  from public.red_envelopes
  where id = envelope_id
  for update;

  if envelope_record is null then
    return jsonb_build_object('success', false, 'error', 'envelope_not_found');
  end if;

  -- Check if already claimed
  if exists (
    select 1 from public.red_envelope_claims
    where red_envelope_id = envelope_id and user_id = current_user_id
  ) then
    return jsonb_build_object('success', false, 'error', 'already_claimed');
  end if;

  -- Check if sender
  if envelope_record.sender_id = current_user_id then
    return jsonb_build_object('success', false, 'error', 'cannot_claim_own');
  end if;

  -- Check if designated type and user is not the designated recipient
  if envelope_record.type = 'designated' and envelope_record.designated_user_id is not null then
    if envelope_record.designated_user_id != current_user_id then
      return jsonb_build_object('success', false, 'error', 'not_designated_recipient');
    end if;
  end if;

  -- Check if available
  if envelope_record.status != 'active' or envelope_record.remaining_quantity <= 0 then
    return jsonb_build_object('success', false, 'error', 'not_available');
  end if;

  -- Calculate claim amount
  if envelope_record.type = 'fixed' or envelope_record.type = 'designated' then
    -- For fixed and designated, amount is the full amount
    claim_amount := envelope_record.remaining_amount;
  else
    -- Random amount for lucky red envelope
    if envelope_record.remaining_quantity = 1 then
      claim_amount := envelope_record.remaining_amount;
    else
      claim_amount := (random() * (envelope_record.remaining_amount / envelope_record.remaining_quantity * 2));
      claim_amount := greatest(0.01, least(claim_amount, envelope_record.remaining_amount - 0.01 * (envelope_record.remaining_quantity - 1)));
    end if;
  end if;
  claim_amount := round(claim_amount, 2);

  -- Get user wallet
  select * into user_wallet
  from public.wallets
  where user_id = current_user_id
  for update;

  if user_wallet is null then
    return jsonb_build_object('success', false, 'error', 'wallet_not_found');
  end if;

  -- Create claim record
  insert into public.red_envelope_claims (red_envelope_id, user_id, amount)
  values (envelope_id, current_user_id, claim_amount);

  -- Update envelope
  update public.red_envelopes
  set 
    remaining_quantity = remaining_quantity - 1,
    remaining_amount = remaining_amount - claim_amount,
    status = case when remaining_quantity - 1 = 0 then 'claimed'::text else status end,
    updated_at = now()
  where id = envelope_id;

  -- Update wallet balance
  new_balance := user_wallet.balance + claim_amount;
  update public.wallets
  set balance = new_balance, updated_at = now()
  where user_id = current_user_id;

  -- Create transaction record
  insert into public.transactions (
    user_id, type, amount, balance_before, balance_after,
    description, reference_id, reference_type
  )
  values (
    current_user_id, 'red_envelope_receive', claim_amount,
    user_wallet.balance, new_balance,
    '领取红包', envelope_id, 'red_envelope'
  );

  return jsonb_build_object(
    'success', true, 
    'amount', claim_amount,
    'new_balance', new_balance
  );
end;
$$;