-- Create wallets table (用户钱包表)
create table public.wallets (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance numeric(10, 2) not null default 0 check (balance >= 0),
  frozen_balance numeric(10, 2) not null default 0 check (frozen_balance >= 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Create transactions table (交易记录表)
create table public.transactions (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('recharge', 'withdraw', 'red_envelope_send', 'red_envelope_receive', 'transfer_send', 'transfer_receive', 'refund')),
  amount numeric(10, 2) not null check (amount > 0),
  balance_before numeric(10, 2) not null,
  balance_after numeric(10, 2) not null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'cancelled')),
  description text,
  reference_id uuid, -- 关联的红包或转账ID
  reference_type text check (reference_type in ('red_envelope', 'transfer', null)),
  created_at timestamp with time zone not null default now()
);

-- Enable RLS
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;

-- RLS policies for wallets
create policy "Users can view their own wallet"
on public.wallets for select
using (user_id = auth.uid());

create policy "Users can update their own wallet"
on public.wallets for update
using (user_id = auth.uid());

create policy "System can insert wallets"
on public.wallets for insert
with check (user_id = auth.uid());

-- RLS policies for transactions
create policy "Users can view their own transactions"
on public.transactions for select
using (user_id = auth.uid());

create policy "System can insert transactions"
on public.transactions for insert
with check (user_id = auth.uid());

-- Create indexes
create index idx_wallets_user on public.wallets(user_id);
create index idx_transactions_user on public.transactions(user_id);
create index idx_transactions_type on public.transactions(type);
create index idx_transactions_reference on public.transactions(reference_id, reference_type);
create index idx_transactions_created on public.transactions(created_at desc);

-- Create trigger for wallet updated_at
create trigger update_wallets_updated_at
before update on public.wallets
for each row
execute function public.update_updated_at_column();

-- Function to create wallet for new users
create or replace function public.create_wallet_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  
  return new;
end;
$$;

-- Trigger to auto-create wallet when profile is created
create trigger on_profile_created_create_wallet
after insert on public.profiles
for each row
execute function public.create_wallet_for_user();

-- Function to handle red envelope claim with balance
create or replace function public.claim_red_envelope_with_balance(envelope_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  -- Check if available
  if envelope_record.status != 'active' or envelope_record.remaining_quantity <= 0 then
    return jsonb_build_object('success', false, 'error', 'not_available');
  end if;

  -- Calculate claim amount
  if envelope_record.type = 'fixed' then
    claim_amount := envelope_record.amount / envelope_record.quantity;
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

-- Function to send red envelope with balance deduction
create or replace function public.send_red_envelope_with_balance(
  p_conversation_id uuid,
  p_amount numeric,
  p_quantity integer,
  p_type text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    expire_at
  )
  values (
    p_conversation_id, current_user_id, p_amount, p_quantity,
    p_quantity, p_amount, p_type, p_message,
    now() + interval '24 hours'
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

-- Function to send transfer with balance
create or replace function public.send_transfer_with_balance(
  p_conversation_id uuid,
  p_receiver_id uuid,
  p_amount numeric,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  user_wallet record;
  new_balance numeric(10, 2);
  transfer_id uuid;
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

  -- Create transfer
  insert into public.transfers (
    conversation_id, sender_id, receiver_id, amount, message, expire_at
  )
  values (
    p_conversation_id, current_user_id, p_receiver_id, p_amount, p_message,
    now() + interval '24 hours'
  )
  returning id into transfer_id;

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
    current_user_id, 'transfer_send', p_amount,
    user_wallet.balance, new_balance,
    '发起转账', transfer_id, 'transfer'
  );

  return jsonb_build_object(
    'success', true,
    'transfer_id', transfer_id,
    'new_balance', new_balance
  );
end;
$$;

-- Function to accept transfer
create or replace function public.accept_transfer_with_balance(transfer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  transfer_record record;
  receiver_wallet record;
  new_balance numeric(10, 2);
begin
  if current_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Get transfer
  select * into transfer_record
  from public.transfers
  where id = transfer_id
  for update;

  if transfer_record is null then
    return jsonb_build_object('success', false, 'error', 'transfer_not_found');
  end if;

  if transfer_record.receiver_id != current_user_id then
    return jsonb_build_object('success', false, 'error', 'not_receiver');
  end if;

  if transfer_record.status != 'pending' then
    return jsonb_build_object('success', false, 'error', 'already_processed');
  end if;

  -- Get receiver wallet
  select * into receiver_wallet
  from public.wallets
  where user_id = current_user_id
  for update;

  if receiver_wallet is null then
    return jsonb_build_object('success', false, 'error', 'wallet_not_found');
  end if;

  -- Update transfer status
  update public.transfers
  set status = 'accepted', accepted_at = now(), updated_at = now()
  where id = transfer_id;

  -- Add to receiver balance
  new_balance := receiver_wallet.balance + transfer_record.amount;
  update public.wallets
  set balance = new_balance, updated_at = now()
  where user_id = current_user_id;

  -- Create transaction record
  insert into public.transactions (
    user_id, type, amount, balance_before, balance_after,
    description, reference_id, reference_type
  )
  values (
    current_user_id, 'transfer_receive', transfer_record.amount,
    receiver_wallet.balance, new_balance,
    '收款', transfer_id, 'transfer'
  );

  return jsonb_build_object(
    'success', true,
    'new_balance', new_balance
  );
end;
$$;