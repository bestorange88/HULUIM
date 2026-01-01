-- Create storage buckets for chat files and images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
  ('chat-images', 'chat-images', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('chat-files', 'chat-files', false, 10485760, null);

-- Storage policies for chat images (public)
create policy "Anyone can view chat images"
on storage.objects for select
using (bucket_id = 'chat-images');

create policy "Authenticated users can upload chat images"
on storage.objects for insert
with check (
  bucket_id = 'chat-images' 
  and auth.role() = 'authenticated'
);

create policy "Users can update their own chat images"
on storage.objects for update
using (
  bucket_id = 'chat-images' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own chat images"
on storage.objects for delete
using (
  bucket_id = 'chat-images' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for chat files (private)
create policy "Users can view their conversation files"
on storage.objects for select
using (
  bucket_id = 'chat-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Authenticated users can upload chat files"
on storage.objects for insert
with check (
  bucket_id = 'chat-files' 
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own chat files"
on storage.objects for delete
using (
  bucket_id = 'chat-files' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Create red_envelopes table (红包表)
create table public.red_envelopes (
  id uuid not null default gen_random_uuid() primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  quantity integer not null default 1 check (quantity > 0),
  remaining_quantity integer not null check (remaining_quantity >= 0),
  remaining_amount numeric(10, 2) not null check (remaining_amount >= 0),
  type text not null check (type in ('fixed', 'random')), -- fixed: 普通红包, random: 拼手气红包
  message text,
  status text not null default 'active' check (status in ('active', 'claimed', 'expired')),
  expire_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Create red_envelope_claims table (红包领取记录表)
create table public.red_envelope_claims (
  id uuid not null default gen_random_uuid() primary key,
  red_envelope_id uuid not null references public.red_envelopes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  claimed_at timestamp with time zone not null default now(),
  unique(red_envelope_id, user_id)
);

-- Create transfers table (转账表)
create table public.transfers (
  id uuid not null default gen_random_uuid() primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  expire_at timestamp with time zone not null,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Enable RLS
alter table public.red_envelopes enable row level security;
alter table public.red_envelope_claims enable row level security;
alter table public.transfers enable row level security;

-- RLS policies for red_envelopes
create policy "Users can view red envelopes in their conversations"
on public.red_envelopes for select
using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = red_envelopes.conversation_id
    and cp.user_id = auth.uid()
  )
);

create policy "Users can create red envelopes in their conversations"
on public.red_envelopes for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversation_id
    and cp.user_id = auth.uid()
  )
);

create policy "Users can update their own red envelopes"
on public.red_envelopes for update
using (sender_id = auth.uid() or auth.uid() in (
  select user_id from public.conversation_participants
  where conversation_id = red_envelopes.conversation_id
));

-- RLS policies for red_envelope_claims
create policy "Users can view claims in their conversations"
on public.red_envelope_claims for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.red_envelopes re
    join public.conversation_participants cp on cp.conversation_id = re.conversation_id
    where re.id = red_envelope_claims.red_envelope_id
    and cp.user_id = auth.uid()
  )
);

create policy "Users can claim red envelopes"
on public.red_envelope_claims for insert
with check (user_id = auth.uid());

-- RLS policies for transfers
create policy "Users can view their own transfers"
on public.transfers for select
using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "Users can create transfers"
on public.transfers for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversation_id
    and cp.user_id = auth.uid()
  )
);

create policy "Receivers can update transfer status"
on public.transfers for update
using (receiver_id = auth.uid());

-- Create indexes
create index idx_red_envelopes_conversation on public.red_envelopes(conversation_id);
create index idx_red_envelopes_sender on public.red_envelopes(sender_id);
create index idx_red_envelopes_status on public.red_envelopes(status);
create index idx_red_envelope_claims_envelope on public.red_envelope_claims(red_envelope_id);
create index idx_red_envelope_claims_user on public.red_envelope_claims(user_id);
create index idx_transfers_conversation on public.transfers(conversation_id);
create index idx_transfers_sender on public.transfers(sender_id);
create index idx_transfers_receiver on public.transfers(receiver_id);
create index idx_transfers_status on public.transfers(status);

-- Create triggers for updated_at
create trigger update_red_envelopes_updated_at
before update on public.red_envelopes
for each row
execute function public.update_updated_at_column();

create trigger update_transfers_updated_at
before update on public.transfers
for each row
execute function public.update_updated_at_column();