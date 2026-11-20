-- Admin can call the cleaner from the order page (2026-11-20, UX audit item 18, the user's choice):
-- when a job's live stream drops, admin needs a way to reach the cleaner. The cleaner's phone
-- (cleaners.phone, set by their agency in B11, 20261114150000_full_windows_cleaner_details.sql) was
-- readable by the agency only. admin_order_detail() now returns it as a new last column,
-- cleaner_phone; the function still answers admins only (is_admin()). Its body is as in
-- 20261114190000_payment_method.sql plus c.phone. No table, policy or grant changes otherwise.

drop function public.admin_order_detail(uuid);

create function public.admin_order_detail(p_order uuid)
returns table (
  order_id uuid,
  order_code text,
  status public.order_status,
  service_id text,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  address text,
  contact_phone text,
  customer_name text,
  agency_id uuid,
  agency_name text,
  cleaner_id uuid,
  cleaner_name text,
  price_idr integer,
  agency_fee_idr integer,
  homeklin_income_idr integer,
  agency_fee_final boolean,
  created_at timestamptz,
  paid_at timestamptz,
  assigned_at timestamptz,
  checked_in_at timestamptz,
  completed_at timestamptz,
  stream_status public.stream_status,
  stream_updated_at timestamptz,
  customer_note text,
  payment_type text,
  cleaner_phone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
    select o.id, o.code, o.status, o.service_id, o.area_id, o.starts_at, o.ends_at, o.address, o.contact_phone,
      p.full_name, a.id, a.name, o.cleaner_id, c.full_name, o.price_idr,
      fee.amount, o.price_idr - fee.amount, f.order_id is not null,
      o.created_at, case when o.status = 'paid' then o.payment_result_at end,
      o.assigned_at, o.checked_in_at, o.completed_at, s.status, s.updated_at, o.customer_note, o.payment_type,
      c.phone
    from public.orders as o
    join public.agencies as a on a.id = o.agency_id
    left join public.profiles as p on p.id = o.customer_id
    left join public.cleaners as c on c.user_id = o.cleaner_id
    left join public.order_fees as f on f.order_id = o.id
    left join public.stream_sessions as s on s.order_id = o.id
    cross join lateral (
      select coalesce(f.fee_idr, round(o.price_idr * a.payout_percent / 100.0)::integer) as amount
    ) as fee
    where o.id = p_order;

  if not found then
    raise exception 'order_not_found';
  end if;
end;
$$;

revoke all on function public.admin_order_detail(uuid) from public, anon;
grant execute on function public.admin_order_detail(uuid) to authenticated;
