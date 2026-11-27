-- owner_numbers: the tiles and the chart show the same last N days (ship review, 2026-11-27).
--
-- Until now the revenue, orders, payouts and status counts of the period used a rolling window
-- (now() - N x 24 hours), while the chart ("daily_period") showed N Jakarta calendar days, today
-- included. An order paid 6 days 23 hours ago was in the 7-day revenue tile but in no bar of the chart, so
-- the two disagreed on the same page. Now the period is the N Jakarta calendar days ending today (from
-- Jakarta midnight of the first day), and "previous" is the N days right before it; the chart is unchanged.
-- Only those two lines change; the rest is as in 20261120110000_owner_status_by_payment_date.sql, and
-- create or replace keeps the grants (repeated below). Jakarta has no daylight saving, so the arithmetic is exact.
-- Rollback: apply 20261120110000_owner_status_by_payment_date.sql again.

create or replace function public.owner_numbers(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_since date := (now() at time zone 'Asia/Jakarta')::date - 29;
  v_start timestamptz;
begin
  if not public.is_owner() then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (7, 30, 90) then
    raise exception 'invalid_days' using detail = 'p_days must be 7, 30 or 90';
  end if;
  -- The last p_days Jakarta calendar days, today included (the chart's bars): from Jakarta midnight of the
  -- first of them. The tiles used `now() - p_days x 24 hours`, up to a day longer, so an order paid just
  -- inside that window was in the revenue tile and not in the chart.
  v_start := ((v_today - (p_days - 1))::timestamp) at time zone 'Asia/Jakarta';

  return jsonb_build_object(
    -- Unchanged from 20261104160100_owner.sql (all time, and the 30-day trend by order date).
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
    ),
    -- New in B5.
    'days', p_days,
    'period', public.owner_period_totals(v_start, now()),
    -- The same number of days right before the period.
    'previous', public.owner_period_totals(v_start - make_interval(days => p_days), v_start),
    -- Revenue per Jakarta day for the last 14 days whatever the period (the chart has 14 bars).
    'daily', (
      select jsonb_agg(jsonb_build_object('date', d.day::date, 'revenue_idr', coalesce(t.revenue, 0)) order by d.day)
      from generate_series(v_today - 13, v_today, interval '1 day') as d(day)
      left join (
        select (coalesce(payment_result_at, created_at) at time zone 'Asia/Jakarta')::date as day,
          sum(price_idr) as revenue
        from public.orders
        where status = 'paid'
          and (coalesce(payment_result_at, created_at) at time zone 'Asia/Jakarta')::date >= v_today - 13
        group by 1
      ) as t on t.day = d.day::date
    ),
    -- Fees per agency in the period; only agencies that earned something, largest first.
    'payouts_by_agency', (
      select coalesce(jsonb_agg(jsonb_build_object('agency_id', a.id, 'name', a.name, 'paid_out_idr', p.paid_out)
        order by p.paid_out desc, a.name), '[]'::jsonb)
      from (
        select fee.agency_id, sum(fee.fee_idr)::bigint as paid_out
        from public.order_fees as fee
        join public.orders as o on o.id = fee.order_id
        where o.completed_at >= v_start
        group by fee.agency_id
      ) as p
      join public.agencies as a on a.id = p.agency_id
    ),
    -- New on 2026-11-20 (the user: the chart follows the chosen period). Revenue per Jakarta day for
    -- the last p_days days, today included, oldest first, dated as 'daily' is.
    'daily_period', (
      select jsonb_agg(jsonb_build_object('date', d.day::date, 'revenue_idr', coalesce(t.revenue, 0)) order by d.day)
      from generate_series(v_today - (p_days - 1), v_today, interval '1 day') as d(day)
      left join (
        select (coalesce(payment_result_at, created_at) at time zone 'Asia/Jakarta')::date as day,
          sum(price_idr) as revenue
        from public.orders
        where status = 'paid'
          and (coalesce(payment_result_at, created_at) at time zone 'Asia/Jakarta')::date >= v_today - (p_days - 1)
        group by 1
      ) as t on t.day = d.day::date
    ),
    -- The orders of the period by status (every status present, 0 when none), dated as revenue is:
    -- by when the payment result arrived (paid, failed, cancelled), else by when the order was made
    -- (still waiting for payment). So "Dibayar" here equals the period's paid orders above it.
    'by_status_period', (
      select jsonb_object_agg(s.status, coalesce(c.count, 0))
      from unnest(enum_range(null::public.order_status)) as s(status)
      left join (
        select status, count(*) as count from public.orders
        where coalesce(payment_result_at, created_at) >= v_start
        group by status
      ) as c on c.status = s.status
    )
  );
end;
$$;

revoke all on function public.owner_numbers(int) from public, anon;
grant execute on function public.owner_numbers(int) to authenticated;
