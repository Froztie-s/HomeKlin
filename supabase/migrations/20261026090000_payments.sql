-- T10: paying for an order with Midtrans Snap (Sandbox: simulated payment, no real money).
-- The server asks Midtrans for a Snap transaction for an order that waits for payment and sends the
-- customer to Midtrans' payment page. The link is stored on the order, so a customer who comes back
-- before paying gets the same transaction instead of a second one. Whether the payment succeeded is
-- only ever decided by Midtrans' signed notification (T11), never by the customer's browser.
-- Sources: https://docs.midtrans.com/reference/backend-integration and
-- https://supabase.com/docs/guides/database/functions

alter table public.orders
  add column payment_token text,
  add column payment_url text check (payment_url is null or payment_url ~ '^https://app(\.sandbox)?\.midtrans\.com/'),
  add column payment_started_at timestamptz;

-- What the payment needs, for the order's own customer only: price, service names, window, phone and
-- any link already made. Never the agency. An empty answer for anyone else.
create function public.order_for_payment(p_order uuid)
returns table (
  order_id uuid,
  service_id text,
  service_name_id text,
  service_name_en text,
  starts_at timestamptz,
  ends_at timestamptz,
  price_idr integer,
  contact_phone text,
  status public.order_status,
  payment_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.service_id, s.name_id, s.name_en, o.starts_at, o.ends_at, o.price_idr, o.contact_phone, o.status, o.payment_url
  from public.orders as o
  join public.services as s on s.id = o.service_id
  where o.id = p_order and o.customer_id = (select auth.uid());
$$;

-- Stores the Snap link on the customer's own order, once, while it waits for payment. Refusals:
-- order_not_payable (not theirs, not waiting for payment, or a link exists already),
-- payment_url_invalid (not Midtrans' payment page).
create function public.attach_payment(p_order uuid, p_token text, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(p_url, '') !~ '^https://app(\.sandbox)?\.midtrans\.com/' or coalesce(btrim(p_token), '') = '' then
    raise exception 'payment_url_invalid';
  end if;

  update public.orders
  set payment_token = p_token, payment_url = p_url, payment_started_at = now()
  where id = p_order
    and customer_id = (select auth.uid())
    and status = 'pending_payment'
    and payment_url is null;

  if not found then
    raise exception 'order_not_payable';
  end if;
end;
$$;

revoke all on function public.order_for_payment(uuid) from public, anon;
revoke all on function public.attach_payment(uuid, text, text) from public, anon;
grant execute on function public.order_for_payment(uuid) to authenticated;
grant execute on function public.attach_payment(uuid, text, text) to authenticated;
