-- T7b: admin manages HomeKlin's services and its one price list (/admin/services).
-- Only a signed-in user whose profile role is admin may add or change a service, and only admin sees
-- services that are switched off. Row-level security enforces this in the database, so a role check
-- in the app is a second line, not the only one. Nobody deletes a service through the API: switching
-- it off (is_active) keeps it for past orders.
-- Sources: https://supabase.com/docs/guides/database/postgres/row-level-security ("Use security
-- definer functions", "Wrap functions with select")

-- Whether the signed-in user is an admin. security definer with an empty search_path, the pattern
-- Supabase recommends for role checks inside policies: it reads profiles directly, so the policy does
-- not depend on the policies of profiles, and it is evaluated once per query through (select ...).
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- T7 took every write right on services away from signed-in users; admin gets insert and update back,
-- limited by the policies below. Delete stays revoked for everyone.
grant insert, update on table public.services to authenticated;

create policy "Admins read every service"
  on public.services
  for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins add services"
  on public.services
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins change services"
  on public.services
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
