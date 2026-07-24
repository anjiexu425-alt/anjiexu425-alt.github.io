-- Toolkit skills and vibe-coding projects, shown on toolkit.html.
-- This migration is safe to run again against the same Supabase project.

create table if not exists public.toolkit_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  description text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.toolkit_skills
drop constraint if exists toolkit_skills_name_length_check;

alter table public.toolkit_skills
add constraint toolkit_skills_name_length_check
check (char_length(btrim(name)) between 1 and 160);

alter table public.toolkit_skills enable row level security;

drop policy if exists "Public can view toolkit skills" on public.toolkit_skills;
create policy "Public can view toolkit skills"
on public.toolkit_skills
for select
to public
using (true);

drop policy if exists "Owner can create toolkit skills" on public.toolkit_skills;
create policy "Owner can create toolkit skills"
on public.toolkit_skills
for insert
to authenticated
with check (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');

drop policy if exists "Owner can edit toolkit skills" on public.toolkit_skills;
create policy "Owner can edit toolkit skills"
on public.toolkit_skills
for update
to authenticated
using (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com')
with check (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');

drop policy if exists "Owner can delete toolkit skills" on public.toolkit_skills;
create policy "Owner can delete toolkit skills"
on public.toolkit_skills
for delete
to authenticated
using (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');

create table if not exists public.toolkit_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  description text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.toolkit_projects
drop constraint if exists toolkit_projects_name_length_check;

alter table public.toolkit_projects
add constraint toolkit_projects_name_length_check
check (char_length(btrim(name)) between 1 and 160);

alter table public.toolkit_projects enable row level security;

drop policy if exists "Public can view toolkit projects" on public.toolkit_projects;
create policy "Public can view toolkit projects"
on public.toolkit_projects
for select
to public
using (true);

drop policy if exists "Owner can create toolkit projects" on public.toolkit_projects;
create policy "Owner can create toolkit projects"
on public.toolkit_projects
for insert
to authenticated
with check (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');

drop policy if exists "Owner can edit toolkit projects" on public.toolkit_projects;
create policy "Owner can edit toolkit projects"
on public.toolkit_projects
for update
to authenticated
using (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com')
with check (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');

drop policy if exists "Owner can delete toolkit projects" on public.toolkit_projects;
create policy "Owner can delete toolkit projects"
on public.toolkit_projects
for delete
to authenticated
using (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');
