-- T9: booking with streaming consent and automatic routing.
-- A customer books a HomeKlin service for a free arrival window in their area. book_slot() routes the
-- booking to one partner agency serving the area that still has a place in that window, takes the
-- place and creates the order in one transaction. The order waits for payment (T10, T11).
-- One brand to the customer: the orders table holds the agency, so customers never read it directly;
-- book_slot() and my_orders() return the order without the agency.
-- Sources: https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE (SKIP LOCKED)
-- and https://supabase.com/docs/guides/database/functions

create type public.order_status as enum ('pending_payment', 'paid', 'failed', 'cancelled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  service_id text not null references public.services (id),
  area_id text not null references public.service_areas (id),
  -- Which agency got the job, through which of its windows. Never shown to the customer.
  agency_id uuid not null references public.agencies (id),
  slot_id uuid not null references public.availability_slots (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  address text not null check (char_length(address) between 10 and 300),
  -- The price when the customer booked; a later price change does not touch this order.
  price_idr integer not null check (price_idr > 0),
  -- The customer agreed that the cleaner streams the job live (SPEC: consent toggle must be on).
  stream_consent boolean not null check (stream_consent),
  status public.order_status not null default 'pending_payment',
  created_at timestamptz not null default now()
);

create index orders_customer on public.orders (customer_id, created_at desc);
create index orders_agency on public.orders (agency_id, starts_at);

comment on table public.orders is
  'Bookings. Holds the routed agency, so only book_slot() and my_orders() (without the agency) reach customers.';

alter table public.orders enable row level security;
revoke all on table public.orders from anon, authenticated;

-- Books a window. Errors are raised with a fixed message the app translates:
-- not_customer, consent_required, address_invalid, service_unavailable, slot_unavailable.
-- Race-safe: the window row is chosen with FOR UPDATE SKIP LOCKED, so two customers at the same
-- moment never take the same place: the second one skips the locked row and takes another agency's
-- place in that window, or finds none and is told the window is no longer free. The update re-checks
-- booked < capacity, and the table's check (booked <= capacity) makes overbooking impossible anyway.
-- Routing: among the agencies with a place left, the one with the most room relative to its capacity,
-- then by chance, so bookings spread over the partners.
create function public.book_slot(
  p_service text,
  p_area text,
  p_starts_at timestamptz,
  p_address text,
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
    (customer_id, service_id, area_id, agency_id, slot_id, starts_at, ends_at, address, price_idr, stream_consent)
  values
    (v_customer, p_service, p_area, v_slot.agency_id, v_slot.id, p_starts_at, v_slot.ends_at, v_address, v_price, true)
  returning id into v_order;

  return query
    select o.id, o.service_id, o.starts_at, o.ends_at, o.price_idr, o.status
    from public.orders as o
    where o.id = v_order;
end;
$$;

-- The signed-in customer's own orders, newest first, without the agency or the window behind them.
create function public.my_orders()
returns table (
  order_id uuid,
  service_id text,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  address text,
  price_idr integer,
  status public.order_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.service_id, o.area_id, o.starts_at, o.ends_at, o.address, o.price_idr, o.status, o.created_at
  from public.orders as o
  where o.customer_id = (select auth.uid())
  order by o.created_at desc;
$$;

revoke all on function public.book_slot(text, text, timestamptz, text, boolean) from public, anon;
revoke all on function public.my_orders() from public, anon;
grant execute on function public.book_slot(text, text, timestamptz, text, boolean) to authenticated;
grant execute on function public.my_orders() to authenticated;
