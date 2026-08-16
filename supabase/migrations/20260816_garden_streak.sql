-- Private Garden of Practice sharing. Only the owner and accepted friends can read a garden.
create table if not exists public.kaishi_gardens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"version":1,"streak":0,"items":["smooth-stone"]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.kaishi_gardens enable row level security;

drop policy if exists "Garden owner and friends can read" on public.kaishi_gardens;
create policy "Garden owner and friends can read"
on public.kaishi_gardens for select to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.kaishi_friend_requests friendship
    where friendship.status = 'accepted'
      and ((friendship.sender_id = auth.uid() and friendship.recipient_id = user_id)
        or (friendship.recipient_id = auth.uid() and friendship.sender_id = user_id))
  )
);

drop policy if exists "Garden owner can insert" on public.kaishi_gardens;
create policy "Garden owner can insert"
on public.kaishi_gardens for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Garden owner can update" on public.kaishi_gardens;
create policy "Garden owner can update"
on public.kaishi_gardens for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Garden owner can delete" on public.kaishi_gardens;
create policy "Garden owner can delete"
on public.kaishi_gardens for delete to authenticated
using (auth.uid() = user_id);

revoke all on public.kaishi_gardens from anon;
grant select, insert, update, delete on public.kaishi_gardens to authenticated;
