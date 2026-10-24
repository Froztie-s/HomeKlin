-- T7: the catalog. HomeKlin's services with one price list (set by admin), the service areas, the
-- partner agencies and the areas they serve, and each agency's availability per area.
-- One brand to the customer (markdown/SPEC.md, "Decisions"): visitors and customers read the active
-- services, the areas, and the combined free arrival windows of an area, never which agency is behind
-- them. The agency tables have no public access at all; free_slots() and served_area_ids() return
-- times and area ids only.
-- Sources: https://supabase.com/docs/guides/database/postgres/row-level-security and
-- https://supabase.com/docs/guides/database/functions (security definer, search_path)

-- The service types customers filter by ("jenis layanan"); their names are UI text in src/messages.
create type public.service_category as enum ('whole-home', 'rooms', 'fabrics');

create table public.services (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 40),
  category public.service_category not null,
  name_id text not null check (char_length(name_id) between 1 and 80),
  name_en text not null check (char_length(name_en) between 1 and 80),
  description_id text not null check (char_length(description_id) between 1 and 300),
  description_en text not null check (char_length(description_en) between 1 and 300),
  -- The one price customers pay, in whole rupiah, shown in full (no hidden fees).
  price_idr integer not null check (price_idr > 0),
  duration_minutes integer not null check (duration_minutes between 30 and 720),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

comment on table public.services is
  'HomeKlin''s services and their one price list. Visitors read the active ones; only the service role (and, from T7b, admin) changes them.';

create table public.service_areas (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 40),
  name_id text not null check (char_length(name_id) between 1 and 80),
  name_en text not null check (char_length(name_en) between 1 and 80),
  sort_order integer not null default 0
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  -- A fixed key (scripts/seed-data.mjs) so the seed and later tasks find the same agency again.
  key text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(key) <= 60),
  name text not null check (char_length(name) between 1 and 120),
  -- The agency's sign-in account (role agency). T27 lets it manage its own availability.
  user_id uuid unique references auth.users (id) on delete set null
);

comment on table public.agencies is
  'Partner agencies. Never readable by visitors or customers (one brand to the customer).';

create table public.agency_areas (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  area_id text not null references public.service_areas (id) on delete cascade,
  primary key (agency_id, area_id)
);

-- An arrival window in which an agency can start `capacity` jobs in one area. A booking (T9) takes one
-- place with a single `update ... set booked = booked + 1 where booked < capacity`, which the row lock
-- makes race-safe; the checks below make overbooking impossible even for a buggy caller.
create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  area_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity smallint not null check (capacity between 1 and 50),
  booked smallint not null default 0 check (booked >= 0),
  check (ends_at > starts_at),
  check (booked <= capacity),
  unique (agency_id, area_id, starts_at),
  -- An agency only offers slots in an area it serves.
  foreign key (agency_id, area_id) references public.agency_areas (agency_id, area_id) on delete cascade
);

create index availability_slots_area_start on public.availability_slots (area_id, starts_at);

-- Row-level security. Services and areas: anyone reads (services only while active); nobody writes
-- through the API. Agencies, their areas and their slots: no access for visitors or users at all.
alter table public.services enable row level security;
alter table public.service_areas enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_areas enable row level security;
alter table public.availability_slots enable row level security;

create policy "Anyone reads the active services"
  on public.services
  for select
  to anon, authenticated
  using (is_active);

create policy "Anyone reads the service areas"
  on public.service_areas
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate, references, trigger on table public.services from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.service_areas from anon, authenticated;
revoke all on table public.agencies from anon, authenticated;
revoke all on table public.agency_areas from anon, authenticated;
revoke all on table public.availability_slots from anon, authenticated;

-- The areas at least one partner agency serves: area ids only, so it reveals no agency.
-- security definer: it reads agency_areas, which callers may not read themselves. search_path is empty
-- so every name below must be schema-qualified.
create function public.served_area_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct area_id from public.agency_areas;
$$;

-- The combined free arrival windows of one area: a window appears when at least one agency serving the
-- area still has a place in it. Times only: no agency, no capacity, no count of agencies. Only future
-- windows, and at most 60 days ahead whatever the caller asks.
create function public.free_slots(p_area text, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select slot.starts_at, slot.ends_at
  from public.availability_slots as slot
  where slot.area_id = p_area
    and slot.booked < slot.capacity
    and slot.starts_at >= greatest(p_from, now())
    and slot.starts_at < least(p_to, now() + interval '60 days')
  group by slot.starts_at, slot.ends_at
  order by slot.starts_at, slot.ends_at;
$$;

-- The active services, filtered by type, by area (only areas some agency serves) and by a keyword
-- matched in both languages. security invoker: row-level security on services still applies. The
-- keyword is matched literally: %, _ and \ are escaped, so they are not wildcards.
create function public.search_services(
  p_query text default null,
  p_category public.service_category default null,
  p_area text default null
)
returns setof public.services
language sql
stable
security invoker
set search_path = ''
as $$
  select service.*
  from public.services as service
  where service.is_active
    and (p_category is null or service.category = p_category)
    and (p_area is null or p_area in (select public.served_area_ids()))
    and (
      coalesce(p_query, '') = ''
      or concat_ws(' ', service.name_id, service.name_en, service.description_id, service.description_en)
        ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by service.sort_order, service.id;
$$;

revoke all on function public.served_area_ids() from public;
revoke all on function public.free_slots(text, timestamptz, timestamptz) from public;
revoke all on function public.search_services(text, public.service_category, text) from public;
grant execute on function public.served_area_ids() to anon, authenticated;
grant execute on function public.free_slots(text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.search_services(text, public.service_category, text) to anon, authenticated;
