-- T30: rating and review after a completed job. The booking's customer rates the HomeKlin service and
-- the cleaner ("Petugas HomeKlin") once per job. Reviews are shown on the service, with the rating, the
-- comment, the date and the cleaner's first name, never the customer's name or a partner agency.

create table public.reviews (
  order_id uuid primary key references public.orders (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  service_id text not null references public.services (id),
  cleaner_id uuid references public.cleaners (user_id) on delete set null,
  service_rating smallint not null check (service_rating between 1 and 5),
  cleaner_rating smallint check (cleaner_rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create index reviews_service on public.reviews (service_id, created_at desc);

alter table public.reviews enable row level security;
revoke all on table public.reviews from anon, authenticated;

-- Refusals: not_customer, job_not_found (not this customer's completed job), review_exists,
-- rating_invalid, comment_invalid.
create function public.submit_review(p_order uuid, p_service_rating integer, p_cleaner_rating integer default null, p_comment text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_comment text := btrim(coalesce(p_comment, ''));
begin
  if not public.current_role_is('customer') then
    raise exception 'not_customer' using errcode = '42501';
  end if;
  select o.service_id, o.cleaner_id into v_job
  from public.orders as o
  where o.id = p_order and o.customer_id = (select auth.uid()) and o.status = 'paid' and o.completed_at is not null;
  if not found then
    raise exception 'job_not_found';
  end if;
  if p_service_rating is null or p_service_rating not between 1 and 5
    or (p_cleaner_rating is not null and p_cleaner_rating not between 1 and 5) then
    raise exception 'rating_invalid';
  end if;
  if char_length(v_comment) > 500 then
    raise exception 'comment_invalid';
  end if;

  insert into public.reviews (order_id, customer_id, service_id, cleaner_id, service_rating, cleaner_rating, comment)
  values (p_order, (select auth.uid()), v_job.service_id, v_job.cleaner_id, p_service_rating,
    case when v_job.cleaner_id is null then null else p_cleaner_rating end, v_comment)
  on conflict (order_id) do nothing;
  if not found then
    raise exception 'review_exists';
  end if;
end;
$$;

-- The customer's own reviews, so the order page knows which jobs are reviewed.
create function public.my_reviews()
returns table (order_id uuid, service_rating smallint, cleaner_rating smallint, comment text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.order_id, r.service_rating, r.cleaner_rating, r.comment, r.created_at
  from public.reviews as r
  where r.customer_id = (select auth.uid())
  order by r.created_at desc;
$$;

-- A service's rating and its latest reviews, for anyone. Only the cleaner's first name is shown.
create function public.service_reviews(p_service text, p_limit integer default 5)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'average', (select round(avg(service_rating)::numeric, 1) from public.reviews where service_id = p_service),
    'count', (select count(*) from public.reviews where service_id = p_service),
    'latest', coalesce((
      select jsonb_agg(jsonb_build_object(
        'service_rating', r.service_rating,
        'cleaner_rating', r.cleaner_rating,
        'comment', r.comment,
        'created_at', r.created_at,
        'cleaner_first_name', split_part(c.full_name, ' ', 1)
      ) order by r.created_at desc)
      from (
        select * from public.reviews where service_id = p_service order by created_at desc limit least(greatest(coalesce(p_limit, 5), 1), 20)
      ) as r
      left join public.cleaners as c on c.user_id = r.cleaner_id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.submit_review(uuid, integer, integer, text) from public, anon;
revoke all on function public.my_reviews() from public, anon;
grant execute on function public.submit_review(uuid, integer, integer, text) to authenticated;
grant execute on function public.my_reviews() to authenticated;
grant execute on function public.service_reviews(text, integer) to anon, authenticated;
