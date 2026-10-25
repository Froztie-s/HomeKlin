-- T9b: ordering without a separate sign-up. The order form asks for a phone number, the customer's
-- contact for the cleaner on the day (the email is the account, verified by an emailed code before the
-- order is placed). This stores the phone on the order and makes book_slot() require it.
-- Format: an Indonesian mobile number in international form, +628 then 7 to 11 digits (the app turns
-- 0812..., 62812... and spaces into this form before it calls book_slot).

alter table public.orders
  add column contact_phone text check (contact_phone is null or contact_phone ~ '^\+628[0-9]{7,11}$');

comment on column public.orders.contact_phone is
  'The customer''s phone for the cleaner on the day (+628...). Empty only on orders made before T9b.';

-- book_slot() gains p_phone; its checks and its race safety are unchanged (see 20261025090000_orders.sql).
drop function public.book_slot(text, text, timestamptz, text, boolean);

create function public.book_slot(
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
      where candidate.area_id = p_area
        and candidate.starts_at = p_starts_at
        and candidate.starts_at > now()
        and candidate.booked < candidate.capacity
      order by candidate.booked::numeric / candidate.capacity, random()
      limit 1
      for update skip locked
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

-- my_orders() also returns the phone (its return type changes, so it is created again).
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
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.service_id, o.area_id, o.starts_at, o.ends_at, o.address, o.contact_phone, o.price_idr, o.status, o.created_at
  from public.orders as o
  where o.customer_id = (select auth.uid())
  order by o.created_at desc;
$$;

revoke all on function public.book_slot(text, text, timestamptz, text, text, boolean) from public, anon;
revoke all on function public.my_orders() from public, anon;
grant execute on function public.book_slot(text, text, timestamptz, text, text, boolean) to authenticated;
grant execute on function public.my_orders() to authenticated;
