-- Share Life notes and their public media assets.
-- This migration is safe to run again against the same Supabase project.

create table if not exists public.share_life_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  douyin_url text not null,
  cover_url text not null,
  cover_path text,
  likes_count bigint not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.share_life_notes
alter column cover_path drop not null;

-- Replace both the original generated constraint name and this migration's
-- stable name so rerunning the file upgrades existing projects as well.
alter table public.share_life_notes
drop constraint if exists share_life_notes_title_check;

alter table public.share_life_notes
drop constraint if exists share_life_notes_title_length_check;

alter table public.share_life_notes
add constraint share_life_notes_title_length_check
check (char_length(btrim(title)) between 1 and 160);

create or replace function public.set_share_life_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_share_life_updated_at on public.share_life_notes;
create trigger set_share_life_updated_at
before update on public.share_life_notes
for each row
execute function public.set_share_life_updated_at();

alter table public.share_life_notes enable row level security;

drop policy if exists "Public can view Share Life notes" on public.share_life_notes;
create policy "Public can view Share Life notes"
on public.share_life_notes
for select
to public
using (true);

drop policy if exists "Authenticated users can create Share Life notes" on public.share_life_notes;
create policy "Authenticated users can create Share Life notes"
on public.share_life_notes
for insert
to authenticated
with check (auth.jwt() ->> 'email' = 'anjiexu0630@163.com');

drop policy if exists "Authenticated users can edit Share Life notes" on public.share_life_notes;
create policy "Authenticated users can edit Share Life notes"
on public.share_life_notes
for update
to authenticated
using (auth.jwt() ->> 'email' = 'anjiexu0630@163.com')
with check (auth.jwt() ->> 'email' = 'anjiexu0630@163.com');

drop policy if exists "Authenticated users can delete Share Life notes" on public.share_life_notes;
create policy "Authenticated users can delete Share Life notes"
on public.share_life_notes
for delete
to authenticated
using (auth.jwt() ->> 'email' = 'anjiexu0630@163.com');

create or replace function public.adjust_share_life_like(note_id uuid, delta integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  if delta is null then
    raise exception 'delta must be -1 or 1';
  end if;

  if delta not in (-1, 1) then
    raise exception 'delta must be -1 or 1';
  end if;

  update public.share_life_notes
  set likes_count = greatest(0, likes_count + delta)
  where id = note_id
  returning likes_count into new_count;

  if not found then
    raise exception 'Share Life note % does not exist', note_id;
  end if;

  return new_count;
end;
$$;

revoke execute on function public.adjust_share_life_like(uuid, integer) from public;
grant execute on function public.adjust_share_life_like(uuid, integer) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('share-life-media', 'share-life-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view Share Life media" on storage.objects;
create policy "Public can view Share Life media"
on storage.objects
for select
to public
using (bucket_id = 'share-life-media');

drop policy if exists "Authenticated users can upload Share Life media" on storage.objects;
create policy "Authenticated users can upload Share Life media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'share-life-media'
  and auth.jwt() ->> 'email' = 'anjiexu0630@163.com'
);

drop policy if exists "Authenticated users can update Share Life media" on storage.objects;
create policy "Authenticated users can update Share Life media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'share-life-media'
  and auth.jwt() ->> 'email' = 'anjiexu0630@163.com'
)
with check (
  bucket_id = 'share-life-media'
  and auth.jwt() ->> 'email' = 'anjiexu0630@163.com'
);

drop policy if exists "Authenticated users can delete Share Life media" on storage.objects;
create policy "Authenticated users can delete Share Life media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'share-life-media'
  and auth.jwt() ->> 'email' = 'anjiexu0630@163.com'
);
