-- T15-T18 and the job side of T28: the job a paid order becomes.
-- A partner agency's cleaners (cleaners), the cleaner the agency assigns to a job routed to it, the
-- cleaner's check-in (time and location, only in the job's window) and check-out (completes the job;
-- the server then attaches the recording, src/lib/recordings/attach.ts), and what each role reads:
--   my_jobs()       the cleaner's own assigned jobs, today and upcoming, and those just finished
--   agency_jobs()   the paid jobs routed to the agency, with the cleaner and the check-in status
--   admin_jobs()    every paid job, read-only
--   my_orders()     the customer's orders, now with the cleaner (as "Petugas HomeKlin", never the
--                   agency), the check-in and the recording
-- recordings.deleted_at marks a recording whose file the 7-day cleanup (T16) has deleted.
-- Every function runs with an empty search_path and checks the caller's role from profiles, never from
-- metadata the user can change. Source: https://supabase.com/docs/guides/database/functions

create table public.cleaners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  -- A photo shown to the customer: a file of the site (/images/...) or an https address.
  photo_url text check (photo_url is null or photo_url ~ '^(/images/[a-z0-9._-]+|https://\S+)$'),
  created_at timestamptz not null default now()
);

create index cleaners_agency on public.cleaners (agency_id);

comment on table public.cleaners is
  'Each cleaner works for one partner agency. Closed to users; read through the functions below.';

alter table public.cleaners enable row level security;
revoke all on table public.cleaners from anon, authenticated;

alter table public.orders
  add column cleaner_id uuid references public.cleaners (user_id) on delete set null,
  add column checked_in_at timestamptz,
  add column check_in_lat double precision check (check_in_lat between -90 and 90),
  add column check_in_lng double precision check (check_in_lng between -180 and 180),
  add column check_in_accuracy_m double precision check (check_in_accuracy_m >= 0);

create index orders_cleaner on public.orders (cleaner_id, starts_at);

alter table public.recordings add column deleted_at timestamptz;

-- The check-in window: from 15 minutes before the arrival window opens until it closes. The same rule
-- is in src/lib/jobs/check-in.ts, which the cleaner's page uses to say when check-in opens.
create function public.check_in_opens(p_starts_at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_starts_at - interval '15 minutes';
$$;

create function public.current_role_is(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = p_role);
$$;

revoke all on function public.current_role_is(public.app_role) from public, anon;
grant execute on function public.current_role_is(public.app_role) to authenticated;

-- The cleaner's own jobs: assigned, paid, not finished (or finished in the last day), ending no more
-- than 12 hours ago. The customer's name and phone are the cleaner's to know; the agency is not shown.
create function public.my_jobs()
returns table (
  order_id uuid,
  service_id text,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  address text,
  contact_phone text,
  customer_name text,
  stream_consent boolean,
  checked_in_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_role_is('cleaner') then
    raise exception 'not_cleaner' using errcode = '42501';
  end if;

  return query
    select o.id, o.service_id, o.area_id, o.starts_at, o.ends_at, o.address, o.contact_phone,
      p.full_name, o.stream_consent, o.checked_in_at, o.completed_at
    from public.orders as o
    left join public.profiles as p on p.id = o.customer_id
    where o.cleaner_id = (select auth.uid())
      and o.status = 'paid'
      and (
        (o.completed_at is null and o.ends_at > now() - interval '12 hours')
        or o.completed_at > now() - interval '1 day'
      )
    order by o.starts_at;
end;
$$;

-- Check-in at the job. Refusals: not_cleaner, job_not_found (not this cleaner's paid job),
-- job_completed, already_checked_in, too_early, too_late, location_invalid.
create function public.check_in(p_order uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
begin
  if not public.current_role_is('cleaner') then
    raise exception 'not_cleaner' using errcode = '42501';
  end if;

  select o.starts_at, o.ends_at, o.checked_in_at, o.completed_at into v_job
  from public.orders as o
  where o.id = p_order and o.cleaner_id = (select auth.uid()) and o.status = 'paid'
  for update;

  if not found then
    raise exception 'job_not_found';
  end if;
  if v_job.completed_at is not null then
    raise exception 'job_completed';
  end if;
  if v_job.checked_in_at is not null then
    raise exception 'already_checked_in';
  end if;
  if now() < public.check_in_opens(v_job.starts_at) then
    raise exception 'too_early';
  end if;
  if now() > v_job.ends_at then
    raise exception 'too_late';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180
    or (p_accuracy is not null and p_accuracy < 0) then
    raise exception 'location_invalid';
  end if;

  update public.orders
  set checked_in_at = now(), check_in_lat = p_lat, check_in_lng = p_lng, check_in_accuracy_m = p_accuracy
  where id = p_order;

  return now();
end;
$$;

-- Check-out: completes the job. A repeat answers the same time, so a retried check-out is harmless
-- (the server attaches the recording after it, which is idempotent too).
-- Refusals: not_cleaner, job_not_found, not_checked_in.
create function public.check_out(p_order uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
begin
  if not public.current_role_is('cleaner') then
    raise exception 'not_cleaner' using errcode = '42501';
  end if;

  select o.checked_in_at, o.completed_at into v_job
  from public.orders as o
  where o.id = p_order and o.cleaner_id = (select auth.uid()) and o.status = 'paid'
  for update;

  if not found then
    raise exception 'job_not_found';
  end if;
  if v_job.completed_at is not null then
    return v_job.completed_at;
  end if;
  if v_job.checked_in_at is null then
    raise exception 'not_checked_in';
  end if;

  update public.orders set completed_at = now() where id = p_order;
  return now();
end;
$$;

-- The agency's own cleaners.
create function public.agency_cleaners()
returns table (cleaner_id uuid, full_name text, photo_url text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_role_is('agency') then
    raise exception 'not_agency' using errcode = '42501';
  end if;

  return query
    select c.user_id, c.full_name, c.photo_url
    from public.cleaners as c
    join public.agencies as a on a.id = c.agency_id
    where a.user_id = (select auth.uid())
    order by c.full_name;
end;
$$;

-- The paid jobs routed to the agency: what it needs to dispatch a cleaner, no customer e-mail.
create function public.agency_jobs()
returns table (
  order_id uuid,
  service_id text,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  address text,
  contact_phone text,
  cleaner_id uuid,
  cleaner_name text,
  checked_in_at timestamptz,
  completed_at timestamptz,
  recording_id uuid,
  recording_expires_at timestamptz,
  recording_deleted boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_role_is('agency') then
    raise exception 'not_agency' using errcode = '42501';
  end if;

  return query
    select o.id, o.service_id, o.area_id, o.starts_at, o.ends_at, o.address, o.contact_phone,
      o.cleaner_id, c.full_name, o.checked_in_at, o.completed_at,
      r.id, r.expires_at, r.deleted_at is not null
    from public.orders as o
    join public.agencies as a on a.id = o.agency_id
    left join public.cleaners as c on c.user_id = o.cleaner_id
    left join public.recordings as r on r.order_id = o.id
    where a.user_id = (select auth.uid()) and o.status = 'paid'
    order by o.starts_at desc;
end;
$$;

-- The agency assigns one of its own cleaners to one of its own jobs, until the job has started.
-- Refusals: not_agency, job_not_found, cleaner_not_found, job_started.
create function public.assign_cleaner(p_order uuid, p_cleaner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid;
  v_job record;
begin
  if not public.current_role_is('agency') then
    raise exception 'not_agency' using errcode = '42501';
  end if;

  select a.id into v_agency from public.agencies as a where a.user_id = (select auth.uid());

  select o.checked_in_at, o.completed_at into v_job
  from public.orders as o
  where o.id = p_order and o.agency_id = v_agency and o.status = 'paid'
  for update;
  if not found then
    raise exception 'job_not_found';
  end if;

  if not exists (select 1 from public.cleaners where user_id = p_cleaner and agency_id = v_agency) then
    raise exception 'cleaner_not_found';
  end if;
  if v_job.checked_in_at is not null or v_job.completed_at is not null then
    raise exception 'job_started';
  end if;

  update public.orders set cleaner_id = p_cleaner where id = p_order;
end;
$$;

-- Every paid job, for admin's dashboard and replay list (read-only).
create function public.admin_jobs()
returns table (
  order_id uuid,
  service_id text,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  agency_name text,
  cleaner_name text,
  checked_in_at timestamptz,
  completed_at timestamptz,
  recording_id uuid,
  recording_expires_at timestamptz,
  recording_deleted boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
    select o.id, o.service_id, o.area_id, o.starts_at, o.ends_at, a.name, c.full_name,
      o.checked_in_at, o.completed_at, r.id, r.expires_at, r.deleted_at is not null
    from public.orders as o
    join public.agencies as a on a.id = o.agency_id
    left join public.cleaners as c on c.user_id = o.cleaner_id
    left join public.recordings as r on r.order_id = o.id
    where o.status = 'paid'
    order by o.starts_at desc;
end;
$$;

-- my_orders() gains the cleaner, the check-in and the recording (its return type changes).
drop function public.my_orders();

create function public.my_orders()
returns table (
  order_id uuid,
  service_id text,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  address text,
  contact_phone text,
  price_idr integer,
  status public.order_status,
  created_at timestamptz,
  cleaner_name text,
  cleaner_photo_url text,
  checked_in_at timestamptz,
  completed_at timestamptz,
  recording_id uuid,
  recording_expires_at timestamptz,
  recording_deleted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.service_id, o.area_id, o.starts_at, o.ends_at, o.address, o.contact_phone, o.price_idr,
    o.status, o.created_at, c.full_name, c.photo_url, o.checked_in_at, o.completed_at,
    r.id, r.expires_at, r.deleted_at is not null
  from public.orders as o
  left join public.cleaners as c on c.user_id = o.cleaner_id
  left join public.recordings as r on r.order_id = o.id
  where o.customer_id = (select auth.uid())
  order by o.created_at desc;
$$;

-- A recording whose file is deleted can no longer be opened, whatever its date says.
create or replace function public.recording_for_viewer(p_recording uuid)
returns table (file_path text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_recording record;
begin
  select r.file_path, r.expires_at, r.deleted_at into v_recording
  from public.recordings as r
  join public.orders as o on o.id = r.order_id
  where r.id = p_recording
    and (
      o.customer_id = (select auth.uid())
      or exists (
        select 1 from public.agencies as a
        where a.id = r.agency_id and a.user_id = (select auth.uid())
      )
      or public.is_admin()
    );

  if not found then
    raise exception 'recording_not_found';
  end if;

  if v_recording.expires_at <= now() or v_recording.deleted_at is not null then
    raise exception 'recording_expired';
  end if;

  return query select v_recording.file_path, v_recording.expires_at;
end;
$$;

revoke all on function public.my_jobs() from public, anon;
revoke all on function public.check_in(uuid, double precision, double precision, double precision) from public, anon;
revoke all on function public.check_out(uuid) from public, anon;
revoke all on function public.agency_cleaners() from public, anon;
revoke all on function public.agency_jobs() from public, anon;
revoke all on function public.assign_cleaner(uuid, uuid) from public, anon;
revoke all on function public.admin_jobs() from public, anon;
revoke all on function public.my_orders() from public, anon;
grant execute on function public.my_jobs() to authenticated;
grant execute on function public.check_in(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function public.check_out(uuid) to authenticated;
grant execute on function public.agency_cleaners() to authenticated;
grant execute on function public.agency_jobs() to authenticated;
grant execute on function public.assign_cleaner(uuid, uuid) to authenticated;
grant execute on function public.admin_jobs() to authenticated;
grant execute on function public.my_orders() to authenticated;
