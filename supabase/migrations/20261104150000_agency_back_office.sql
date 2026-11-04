-- T27 and T28: the partner agency's back office. An agency manages its own arrival windows in the areas
-- it serves ("Jadwal"): adds a window, changes how many cleaners it can send, removes a window nobody
-- booked. The customer's combined free windows (free_slots) follow at once. An agency never touches
-- services or prices (T7 revoked every write right on them) nor another agency's windows: each function
-- below works only on the caller's own agency, found from the sign-in (agencies.user_id).
-- Adding a cleaner needs a sign-in account, so it is a server action with the secret key
-- (src/lib/agency/actions.ts); my_agency() tells it which agency the caller is.

create function public.my_agency_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id from public.agencies as a
  where a.user_id = (select auth.uid()) and public.current_role_is('agency');
$$;

revoke all on function public.my_agency_id() from public, anon;
grant execute on function public.my_agency_id() to authenticated;

-- The signed-in agency: its id, name and the areas it serves. Refusal: not_agency.
create function public.my_agency()
returns table (agency_id uuid, name text, area_ids text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_agency uuid := public.my_agency_id();
begin
  if v_agency is null then
    raise exception 'not_agency' using errcode = '42501';
  end if;
  return query
    select a.id, a.name, coalesce(array_agg(aa.area_id order by aa.area_id) filter (where aa.area_id is not null), '{}')
    from public.agencies as a
    left join public.agency_areas as aa on aa.agency_id = a.id
    where a.id = v_agency
    group by a.id, a.name;
end;
$$;

-- The agency's own windows from a time on (default: from now), earliest first, at most 60 days ahead.
create function public.agency_slots(p_from timestamptz default null)
returns table (slot_id uuid, area_id text, starts_at timestamptz, ends_at timestamptz, capacity integer, booked integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_agency uuid := public.my_agency_id();
begin
  if v_agency is null then
    raise exception 'not_agency' using errcode = '42501';
  end if;
  return query
    select s.id, s.area_id, s.starts_at, s.ends_at, s.capacity::integer, s.booked::integer
    from public.availability_slots as s
    where s.agency_id = v_agency
      and s.starts_at >= coalesce(p_from, now())
      and s.starts_at < now() + interval '60 days'
    order by s.starts_at, s.area_id;
end;
$$;

-- Adds a window. Refusals: not_agency, area_not_served, window_invalid (not in the future, not after its
-- start, longer than 12 hours or more than 60 days ahead), capacity_invalid (1 to 20), slot_exists.
create function public.add_slot(p_area text, p_starts_at timestamptz, p_ends_at timestamptz, p_capacity integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid := public.my_agency_id();
  v_slot uuid;
begin
  if v_agency is null then
    raise exception 'not_agency' using errcode = '42501';
  end if;
  if not exists (select 1 from public.agency_areas where agency_id = v_agency and area_id = p_area) then
    raise exception 'area_not_served';
  end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at <= now() or p_ends_at <= p_starts_at
    or p_ends_at - p_starts_at > interval '12 hours' or p_starts_at > now() + interval '60 days' then
    raise exception 'window_invalid';
  end if;
  if p_capacity is null or p_capacity not between 1 and 20 then
    raise exception 'capacity_invalid';
  end if;

  insert into public.availability_slots (agency_id, area_id, starts_at, ends_at, capacity)
  values (v_agency, p_area, p_starts_at, p_ends_at, p_capacity)
  on conflict (agency_id, area_id, starts_at) do nothing
  returning id into v_slot;
  if v_slot is null then
    raise exception 'slot_exists';
  end if;
  return v_slot;
end;
$$;

-- Changes how many cleaners the agency can send in one of its windows; never below the places already
-- booked. Refusals: not_agency, slot_not_found, capacity_invalid, capacity_below_booked.
create function public.set_slot_capacity(p_slot uuid, p_capacity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid := public.my_agency_id();
  v_booked integer;
begin
  if v_agency is null then
    raise exception 'not_agency' using errcode = '42501';
  end if;
  select booked into v_booked from public.availability_slots where id = p_slot and agency_id = v_agency for update;
  if not found then
    raise exception 'slot_not_found';
  end if;
  if p_capacity is null or p_capacity not between 1 and 20 then
    raise exception 'capacity_invalid';
  end if;
  if p_capacity < v_booked then
    raise exception 'capacity_below_booked';
  end if;
  update public.availability_slots set capacity = p_capacity where id = p_slot;
end;
$$;

-- Removes one of the agency's windows that nobody has booked. Refusals: not_agency, slot_not_found,
-- slot_booked.
create function public.delete_slot(p_slot uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid := public.my_agency_id();
  v_slot record;
begin
  if v_agency is null then
    raise exception 'not_agency' using errcode = '42501';
  end if;
  select s.booked, exists (select 1 from public.orders as o where o.slot_id = s.id) as has_orders into v_slot
  from public.availability_slots as s where s.id = p_slot and s.agency_id = v_agency for update;
  if not found then
    raise exception 'slot_not_found';
  end if;
  if v_slot.booked > 0 or v_slot.has_orders then
    raise exception 'slot_booked';
  end if;
  delete from public.availability_slots where id = p_slot;
end;
$$;

revoke all on function public.my_agency() from public, anon;
revoke all on function public.agency_slots(timestamptz) from public, anon;
revoke all on function public.add_slot(text, timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.set_slot_capacity(uuid, integer) from public, anon;
revoke all on function public.delete_slot(uuid) from public, anon;
grant execute on function public.my_agency() to authenticated;
grant execute on function public.agency_slots(timestamptz) to authenticated;
grant execute on function public.add_slot(text, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.set_slot_capacity(uuid, integer) to authenticated;
grant execute on function public.delete_slot(uuid) to authenticated;
