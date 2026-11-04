-- T22, T23, T25, T29: the live view of a job. A cleaner who has checked in starts the stream of that
-- job; the page reports its state (active, weak signal, disconnected) and check-out ends it. Who may
-- watch (SPEC "Video access rules"):
--   the customer   only the cleaner of their own job, only while it is in progress, only with consent
--   the agency     its own cleaners' streams
--   admin          every stream (the multi-feed grid)
-- Nobody can list streams except admin (all) and an agency (its own). stream_for_viewer() answers
-- stream_not_found to everyone else, the same as for a job without a stream. The video itself comes
-- from a "stream source" on the server (src/lib/stream/source.ts): the demo source plays a library
-- clip; a LiveKit source can replace it (T31-T32) without changing these rules.

create type public.stream_status as enum ('active', 'weak', 'disconnected', 'ended');

create table public.stream_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  cleaner_id uuid not null references public.cleaners (user_id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  source text not null default 'demo' check (source in ('demo', 'livekit')),
  status public.stream_status not null default 'active',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

create index stream_sessions_live on public.stream_sessions (status) where status <> 'ended';

alter table public.stream_sessions enable row level security;
revoke all on table public.stream_sessions from anon, authenticated;

-- The cleaner starts (or restarts) the stream of their own job in progress. Refusals: not_cleaner,
-- job_not_found, not_checked_in, job_completed, consent_missing.
create function public.start_stream(p_order uuid, p_source text default 'demo')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_session uuid;
begin
  if not public.current_role_is('cleaner') then
    raise exception 'not_cleaner' using errcode = '42501';
  end if;
  if p_source not in ('demo', 'livekit') then
    raise exception 'source_invalid';
  end if;

  select o.agency_id, o.checked_in_at, o.completed_at, o.stream_consent into v_job
  from public.orders as o
  where o.id = p_order and o.cleaner_id = (select auth.uid()) and o.status = 'paid';
  if not found then
    raise exception 'job_not_found';
  end if;
  if v_job.completed_at is not null then
    raise exception 'job_completed';
  end if;
  if v_job.checked_in_at is null then
    raise exception 'not_checked_in';
  end if;
  if not v_job.stream_consent then
    raise exception 'consent_missing';
  end if;

  insert into public.stream_sessions (order_id, cleaner_id, agency_id, source)
  values (p_order, (select auth.uid()), v_job.agency_id, p_source)
  on conflict (order_id) do update
    set status = 'active', source = excluded.source, updated_at = now(), ended_at = null
  returning id into v_session;
  return v_session;
end;
$$;

-- The cleaner's page reports the stream's state, or ends it. Refusals: not_cleaner, stream_not_found.
create function public.set_stream_status(p_order uuid, p_status public.stream_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_role_is('cleaner') then
    raise exception 'not_cleaner' using errcode = '42501';
  end if;
  update public.stream_sessions
  set status = p_status,
      updated_at = now(),
      ended_at = case when p_status = 'ended' then now() else null end
  -- An ended stream stays ended; starting it again is start_stream's job.
  where order_id = p_order and cleaner_id = (select auth.uid()) and status <> 'ended';
  if not found then
    raise exception 'stream_not_found';
  end if;
end;
$$;

-- What a viewer may see of one job's stream. The customer: their own job, with consent, checked in,
-- not completed, and a stream that has not ended. The agency: its own job's stream. Admin: any stream.
-- Everyone else, and a job without a stream: stream_not_found.
create function public.stream_for_viewer(p_order uuid)
returns table (session_id uuid, order_id uuid, status public.stream_status, source text, started_at timestamptz, cleaner_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row record;
begin
  select s.id, s.order_id, s.status, s.source, s.started_at, c.full_name, o.customer_id, o.stream_consent,
    o.checked_in_at, o.completed_at, a.user_id as agency_user
  into v_row
  from public.stream_sessions as s
  join public.orders as o on o.id = s.order_id
  join public.agencies as a on a.id = s.agency_id
  left join public.cleaners as c on c.user_id = s.cleaner_id
  where s.order_id = p_order and s.status <> 'ended';

  if not found then
    raise exception 'stream_not_found';
  end if;

  if not (
    public.is_admin()
    or v_row.agency_user = v_user
    or (
      v_row.customer_id = v_user and v_row.stream_consent and v_row.checked_in_at is not null and v_row.completed_at is null
    )
  ) then
    raise exception 'stream_not_found';
  end if;

  return query select v_row.id, v_row.order_id, v_row.status, v_row.source, v_row.started_at, v_row.full_name;
end;
$$;

-- The streams that have not ended: every one for admin (the multi-feed grid), the agency's own for
-- an agency. Refusals: not_allowed for any other role.
create function public.live_streams()
returns table (
  session_id uuid,
  order_id uuid,
  status public.stream_status,
  source text,
  started_at timestamptz,
  updated_at timestamptz,
  service_id text,
  area_id text,
  cleaner_name text,
  agency_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin();
begin
  if not v_admin and not public.current_role_is('agency') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return query
    select s.id, s.order_id, s.status, s.source, s.started_at, s.updated_at, o.service_id, o.area_id, c.full_name, a.name
    from public.stream_sessions as s
    join public.orders as o on o.id = s.order_id
    join public.agencies as a on a.id = s.agency_id
    left join public.cleaners as c on c.user_id = s.cleaner_id
    where s.status <> 'ended' and (v_admin or a.user_id = (select auth.uid()))
    order by s.started_at;
end;
$$;

-- Check-out also ends the job's stream (the rest is as in 20261104090000_jobs.sql).
create or replace function public.check_out(p_order uuid)
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
  update public.stream_sessions set status = 'ended', ended_at = now(), updated_at = now()
  where order_id = p_order and status <> 'ended';
  return now();
end;
$$;

revoke all on function public.start_stream(uuid, text) from public, anon;
revoke all on function public.set_stream_status(uuid, public.stream_status) from public, anon;
revoke all on function public.stream_for_viewer(uuid) from public, anon;
revoke all on function public.live_streams() from public, anon;
grant execute on function public.start_stream(uuid, text) to authenticated;
grant execute on function public.set_stream_status(uuid, public.stream_status) to authenticated;
grant execute on function public.stream_for_viewer(uuid) to authenticated;
grant execute on function public.live_streams() to authenticated;
