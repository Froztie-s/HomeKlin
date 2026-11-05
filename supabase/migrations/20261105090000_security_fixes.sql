-- T34 security review fixes (2026-11-05).
-- M2: an order nobody pays for kept its place in the window for good (Midtrans sends nothing when no
-- payment was ever started), and one account could book every window. release_unpaid_orders() cancels
-- orders still waiting for payment 2 hours after they were made (a Snap payment lasts 60 minutes, and
-- may be started up to an hour later) and gives their places back, under the same row lock as
-- apply_payment_result(). book_slot() runs it first and allows a customer at most 3 unpaid orders
-- (too_many_unpaid). The daily cron runs it too.
-- L1: stream_for_viewer() let anyone in when the job's agency had no sign-in account, because
-- "agency_user = caller" is null then and "if not (... or null ...)" does not raise. It now refuses.

create function public.release_unpaid_orders(p_older_than interval default interval '2 hours')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_released integer := 0;
begin
  for v_order in
    select o.id, o.slot_id from public.orders as o
    where o.status = 'pending_payment' and o.created_at < now() - p_older_than
    for update skip locked
  loop
    update public.orders set status = 'cancelled', payment_result_at = now() where id = v_order.id;
    update public.availability_slots set booked = booked - 1 where id = v_order.slot_id and booked > 0;
    v_released := v_released + 1;
  end loop;
  return v_released;
end;
$$;

revoke all on function public.release_unpaid_orders(interval) from public, anon, authenticated;
grant execute on function public.release_unpaid_orders(interval) to service_role;

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

  -- T34 (M2): free the places of orders nobody paid for, then allow at most 3 unpaid orders each.
  perform public.release_unpaid_orders();
  if (select count(*) from public.orders as unpaid where unpaid.customer_id = v_customer and unpaid.status = 'pending_payment') >= 3 then
    raise exception 'too_many_unpaid';
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

create or replace function public.stream_for_viewer(p_order uuid)
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

  -- coalesce: an agency without a sign-in (user_id null) must refuse, not let everyone in (T34, L1).
  if not coalesce(
    public.is_admin()
    or v_row.agency_user = v_user
    or (
      v_row.customer_id = v_user and v_row.stream_consent and v_row.checked_in_at is not null and v_row.completed_at is null
    ),
    false
  ) then
    raise exception 'stream_not_found';
  end if;

  return query select v_row.id, v_row.order_id, v_row.status, v_row.source, v_row.started_at, v_row.full_name;
end;
$$;
