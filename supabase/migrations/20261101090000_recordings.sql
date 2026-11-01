-- T13: recordings. Storage and the 7-day expiry are real; the footage is demo footage (SPEC). A finished
-- job gets its own copy of a clip from a small library, so deleting it after 7 days (T16) touches
-- nothing else. Files live in the private bucket "recordings": library/<clip> and jobs/<order id>.<ext>.
-- Nobody reaches a file or a row directly. There are no storage policies on this bucket and the table
-- is closed, so only the secret key can read them, and T14's endpoint hands out short-lived signed
-- links to the booking's customer, the owning agency and admin.
-- A job is an order here: an order that was paid is the job the cleaner does.
-- Sources: https://supabase.com/docs/guides/storage/buckets/fundamentals and
-- https://supabase.com/docs/guides/storage/security/access-control

-- When the cleaner finished the job (T18 sets it at check-out; null until then).
alter table public.orders add column completed_at timestamptz;

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  -- The owning agency, copied from the order: it may replay its own cleaners' recordings.
  agency_id uuid not null references public.agencies (id),
  file_path text not null unique check (file_path ~ '^jobs/[0-9a-f-]{36}\.(mp4|webm)$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create index recordings_agency on public.recordings (agency_id, created_at desc);
create index recordings_expiry on public.recordings (expires_at);

comment on table public.recordings is
  'One recording per job. Closed to every user: T14 checks who may replay it and signs a short-lived link.';

alter table public.recordings enable row level security;
revoke all on table public.recordings from anon, authenticated;

-- Private, video only, and at most 50 MB a file (the free plan's limit).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 52428800, array['video/mp4', 'video/webm']);

-- Records a job's recording, once; running it again returns the one that exists (a repeated check-out).
-- Refusals: retention_invalid, order_not_found, order_not_paid. The retention is a parameter so T16's
-- deletion can be tested with a short one; the app passes 7 days (src/lib/recordings/attach.ts).
create function public.attach_recording(p_order uuid, p_path text, p_retention interval)
returns table (recording_id uuid, file_path text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  if p_retention is null or p_retention <= interval '0' then
    raise exception 'retention_invalid';
  end if;

  select o.status, o.agency_id into v_order
  from public.orders as o
  where o.id = p_order;

  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status <> 'paid' then
    raise exception 'order_not_paid';
  end if;

  insert into public.recordings (order_id, agency_id, file_path, expires_at)
  values (p_order, v_order.agency_id, p_path, now() + p_retention)
  on conflict (order_id) do nothing;

  return query
  select r.id, r.file_path, r.expires_at
  from public.recordings as r
  where r.order_id = p_order;
end;
$$;

revoke all on function public.attach_recording(uuid, text, interval) from public, anon, authenticated;
grant execute on function public.attach_recording(uuid, text, interval) to service_role;
