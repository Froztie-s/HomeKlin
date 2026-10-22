-- T5: one profile per user, with one role, created automatically at sign-up.
-- Roles (markdown/SPEC.md, "Users and roles"): customer, cleaner, agency, admin.
-- Every sign-up becomes a customer. Only the service role (seed script, admin tooling) changes a
-- role, so a user can never make themselves a cleaner, an agency or an admin.
-- Sources: https://supabase.com/docs/guides/auth/managing-user-data and
-- https://supabase.com/docs/guides/database/postgres/row-level-security

create type public.app_role as enum ('customer', 'cleaner', 'agency', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text not null default '' check (char_length(full_name) <= 120),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per user: display name and role. Rows come from handle_new_user(); roles change only through the service role.';

alter table public.profiles enable row level security;

-- A signed-in user reads only their own row. auth.uid() is wrapped in a select so Postgres
-- evaluates it once per query instead of once per row (Supabase RLS performance advice).
create policy "Users read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- No insert, update or delete policies, and no table rights for them either: rows come from the
-- trigger below and roles from the service role. Visitors who are not signed in get nothing.
revoke all on table public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on table public.profiles from authenticated;

-- Creates the profile when Supabase Auth creates the user. The role is never read from the sign-up
-- metadata (a visitor controls that), only the display name, trimmed to the column's limit.
-- security definer: the trigger runs as the table owner, because the signing-up user has no
-- insert right. search_path is empty so every name below must be schema-qualified.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
