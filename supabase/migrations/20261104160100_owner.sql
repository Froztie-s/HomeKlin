-- T29b and T29c: the owner dashboard. The owner sees the business numbers (revenue from paid orders,
-- orders by status, a 30-day trend, jobs and revenue per partner agency, with no customer personal
-- data), oversees the partner agencies (adds one, suspends or reactivates one) and the admin accounts.
-- A suspended agency gets no new bookings and its windows are not offered; jobs it already has stay
-- with it. Admin accounts are created and removed by a server action with the secret key
-- (src/lib/owner/actions.ts), which owner_admins() and is_owner() support.

alter table public.agencies
  add column status text not null default 'active' check (status in ('active', 'suspended')),
  add column created_at timestamptz not null default now();

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'owner');
$$;

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- Areas some active agency serves (suspended agencies no longer count).
create or replace function public.served_area_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct aa.area_id
  from public.agency_areas as aa
  join public.agencies as a on a.id = aa.agency_id
  where a.status = 'active';
$$;

-- The combined free windows of an area, from active agencies only (otherwise as in T7).
create or replace function public.free_slots(p_area text, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select slot.starts_at, slot.ends_at
  from public.availability_slots as slot
  join public.agencies as agency on agency.id = slot.agency_id
  where slot.area_id = p_area
    and agency.status = 'active'
    and slot.booked < slot.capacity
    and slot.starts_at >= greatest(p_from, now())
    and slot.starts_at < least(p_to, now() + interval '60 days')
  group by slot.starts_at, slot.ends_at
  order by slot.starts_at, slot.ends_at;
$$;

-- book_slot() routes only to active agencies (otherwise as in 20261025140000_order_contact.sql).
create or replace function public.book_slot(
  p_service text,
  p_area text,
  p_starts_at timestamptz,
  p_address text,
  p_phone text,
  p_consent boolean
)
returns table (
  order_id uuid,
  service_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  price_idr integer,
  status public.order_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := (select auth.uid());
  v_price integer;
  v_slot record;
  v_order uuid;
  v_address text := btrim(coalesce(p_address, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
begin
  if v_customer is null or not exists (
    select 1 from public.profiles where id = v_customer and role = 'customer'
  ) then
    raise exception 'not_customer' using errcode = '42501';
  end if;

  if p_consent is not true then
    raise exception 'consent_required';
  end if;

  if char_length(v_address) not between 10 and 300 then
    raise exception 'address_invalid';
  end if;

  if v_phone !~ '^\+628[0-9]{7,11}$' then
    raise exception 'phone_invalid';
  end if;

  select service.price_idr into v_price
  from public.services as service
  where service.id = p_service and service.is_active;
  if v_price is null then
    raise exception 'service_unavailable';
  end if;

  update public.availability_slots as slot
  set booked = slot.booked + 1
  where slot.id = (
      select candidate.id
      from public.availability_slots as candidate
      join public.agencies as agency on agency.id = candidate.agency_id
      where candidate.area_id = p_area
        and candidate.starts_at = p_starts_at
        and candidate.starts_at > now()
        and candidate.booked < candidate.capacity
        and agency.status = 'active'
      order by candidate.booked::numeric / candidate.capacity, random()
      limit 1
      for update of candidate skip locked
    )
    and slot.booked < slot.capacity
  returning slot.id, slot.agency_id, slot.ends_at into v_slot;

  if v_slot.id is null then
    raise exception 'slot_unavailable';
  end if;

  insert into public.orders
    (customer_id, service_id, area_id, agency_id, slot_id, starts_at, ends_at, address, contact_phone, price_idr, stream_consent)
  values
    (v_customer, p_service, p_area, v_slot.agency_id, v_slot.id, p_starts_at, v_slot.ends_at, v_address, v_phone, v_price, true)
  returning id into v_order;

  return query
    select o.id, o.service_id, o.starts_at, o.ends_at, o.price_idr, o.status
    from public.orders as o
    where o.id = v_order;
end;
$$;

-- The business numbers, as one JSON document: revenue and counts from paid orders, orders by status,
-- the last 30 days (Jakarta dates) and each partner agency's jobs and revenue. No customer data at all.
-- Refusal: not_owner.
create function public.owner_numbers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since date := (now() at time zone 'Asia/Jakarta')::date - 29;
begin
  if not public.is_owner() then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'revenue_idr', (select coalesce(sum(price_idr), 0) from public.orders where status = 'paid'),
    'paid_orders', (select count(*) from public.orders where status = 'paid'),
    'completed_jobs', (select count(*) from public.orders where status = 'paid' and completed_at is not null),
    'by_status', (
      select jsonb_object_agg(s.status, coalesce(c.count, 0))
      from unnest(enum_range(null::public.order_status)) as s(status)
      left join (select status, count(*) as count from public.orders group by status) as c on c.status = s.status
    ),
    'trend', (
      select jsonb_agg(jsonb_build_object('date', d.day, 'orders', coalesce(t.orders, 0), 'revenue_idr', coalesce(t.revenue, 0)) order by d.day)
      from generate_series(v_since, v_since + 29, interval '1 day') as d(day)
      left join (
        select (created_at at time zone 'Asia/Jakarta')::date as day,
          count(*) as orders,
          sum(price_idr) filter (where status = 'paid') as revenue
        from public.orders
        where (created_at at time zone 'Asia/Jakarta')::date >= v_since
        group by 1
      ) as t on t.day = d.day::date
    ),
    'agencies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'agency_id', a.id, 'name', a.name, 'status', a.status,
        'jobs', coalesce(n.jobs, 0), 'completed', coalesce(n.completed, 0), 'revenue_idr', coalesce(n.revenue, 0)
      ) order by coalesce(n.revenue, 0) desc, a.name), '[]'::jsonb)
      from public.agencies as a
      left join (
        select agency_id, count(*) as jobs, count(completed_at) as completed, sum(price_idr) as revenue
        from public.orders where status = 'paid' group by agency_id
      ) as n on n.agency_id = a.id
    )
  );
end;
$$;

-- The partner agencies with what the owner oversees: status, areas, cleaners, jobs. Refusal: not_owner.
create function public.owner_agencies()
returns table (
  agency_id uuid,
  key text,
  name text,
  status text,
  area_ids text[],
  cleaners bigint,
  jobs bigint,
  revenue_idr bigint,
  has_sign_in boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return query
    select a.id, a.key, a.name, a.status,
      coalesce((select array_agg(aa.area_id order by aa.area_id) from public.agency_areas as aa where aa.agency_id = a.id), '{}'),
      (select count(*) from public.cleaners as c where c.agency_id = a.id),
      (select count(*) from public.orders as o where o.agency_id = a.id and o.status = 'paid'),
      (select coalesce(sum(o.price_idr), 0)::bigint from public.orders as o where o.agency_id = a.id and o.status = 'paid'),
      a.user_id is not null,
      a.created_at
    from public.agencies as a
    order by a.status, a.name;
end;
$$;

-- Adds a partner agency serving the given areas. Refusals: not_owner, name_invalid, area_not_found.
create function public.owner_add_agency(p_name text, p_areas text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_key text;
  v_agency uuid;
begin
  if not public.is_owner() then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'name_invalid';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_areas, '{}')) as wanted(area_id)
    where not exists (select 1 from public.service_areas as sa where sa.id = wanted.area_id)
  ) then
    raise exception 'area_not_found';
  end if;

  v_key := left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 40) || '-' || substr(md5(random()::text), 1, 6);
  insert into public.agencies (key, name) values (v_key, v_name) returning id into v_agency;
  insert into public.agency_areas (agency_id, area_id)
  select v_agency, area_id from unnest(coalesce(p_areas, '{}')) as wanted(area_id)
  on conflict do nothing;
  return v_agency;
end;
$$;

-- Suspends or reactivates a partner agency. Refusals: not_owner, status_invalid, agency_not_found.
create function public.owner_set_agency_status(p_agency uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'status_invalid';
  end if;
  update public.agencies set status = p_status where id = p_agency;
  if not found then
    raise exception 'agency_not_found';
  end if;
end;
$$;

-- The admin accounts, for the owner. Refusal: not_owner.
create function public.owner_admins()
returns table (user_id uuid, full_name text, email text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, u.email::text, p.created_at
    from public.profiles as p
    join auth.users as u on u.id = p.id
    where p.role = 'admin'
    order by p.full_name, u.email;
end;
$$;

revoke all on function public.owner_numbers() from public, anon;
revoke all on function public.owner_agencies() from public, anon;
revoke all on function public.owner_add_agency(text, text[]) from public, anon;
revoke all on function public.owner_set_agency_status(uuid, text) from public, anon;
revoke all on function public.owner_admins() from public, anon;
grant execute on function public.owner_numbers() to authenticated;
grant execute on function public.owner_agencies() to authenticated;
grant execute on function public.owner_add_agency(text, text[]) to authenticated;
grant execute on function public.owner_set_agency_status(uuid, text) to authenticated;
grant execute on function public.owner_admins() to authenticated;
