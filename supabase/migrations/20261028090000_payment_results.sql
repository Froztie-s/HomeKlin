-- T11: recording Midtrans' verdict on an order. The payment notification endpoint
-- (src/app/api/payments/midtrans/route.ts) checks Midtrans' signature and then calls
-- apply_payment_result() with the order's new status: paid, failed or cancelled.
-- An order waiting for payment moves once. A repeat, or a late contradicting notification, changes
-- nothing and gets the status the order already has, so Midtrans' retries and duplicates are harmless
-- (Midtrans: "Implement notification handling in an idempotent way").
-- A failed or cancelled order gives its place in the window back, once: the order row is locked first,
-- so notifications arriving at the same moment wait for each other and only the first one moves it.
-- The one way back: money that arrives after a failure. On Midtrans' payment page a customer whose card
-- was declined can try again, and notifications may arrive out of order. Then the order is paid after
-- all, if its place in the window is still free to take again; if the window has filled up meanwhile,
-- it stays failed or cancelled (the endpoint logs it, so the payment can be refunded).
-- Sources: https://docs.midtrans.com/docs/https-notification-webhooks,
-- https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE and
-- https://supabase.com/docs/guides/database/functions

-- When Midtrans' verdict was recorded (null while the order waits for payment).
alter table public.orders add column payment_result_at timestamptz;

-- Refusals: status_invalid (not paid, failed or cancelled), order_not_found, amount_mismatch (the
-- notification's amount is not the order's price).
create function public.apply_payment_result(p_order uuid, p_status public.order_status, p_amount integer)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  if p_status is null or p_status not in ('paid', 'failed', 'cancelled') then
    raise exception 'status_invalid';
  end if;

  select o.status, o.price_idr, o.slot_id into v_order
  from public.orders as o
  where o.id = p_order
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.price_idr is distinct from p_amount then
    raise exception 'amount_mismatch';
  end if;

  if v_order.status = 'pending_payment' then
    update public.orders
    set status = p_status, payment_result_at = now()
    where id = p_order;

    if p_status in ('failed', 'cancelled') then
      update public.availability_slots
      set booked = booked - 1
      where id = v_order.slot_id and booked > 0;
    end if;

    return p_status;
  end if;

  if p_status = 'paid' and v_order.status in ('failed', 'cancelled') then
    update public.availability_slots
    set booked = booked + 1
    where id = v_order.slot_id and booked < capacity;

    if found then
      update public.orders
      set status = 'paid', payment_result_at = now()
      where id = p_order;
      return 'paid';
    end if;
  end if;

  return v_order.status;
end;
$$;

-- Only HomeKlin's server, with the secret key: customers and visitors could otherwise mark their own
-- orders as paid.
revoke all on function public.apply_payment_result(uuid, public.order_status, integer) from public, anon, authenticated;
grant execute on function public.apply_payment_result(uuid, public.order_status, integer) to service_role;
