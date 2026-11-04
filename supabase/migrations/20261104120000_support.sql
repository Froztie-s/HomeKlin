-- T19-T21: customer support. A bilingual FAQ anyone can search; when it does not help, a signed-in
-- customer escalates the question into a chat ticket; admins answer from an inbox ordered by urgency
-- and age. Both sides see new messages at once through Supabase Realtime, which honours the row-level
-- security below: a customer receives only their own tickets' messages, an admin every ticket's.
-- Writes go through functions that check the role and the ticket's owner; nobody inserts rows directly.
-- Sources: https://supabase.com/docs/guides/realtime/postgres-changes ("Private schemas and RLS") and
-- https://supabase.com/docs/guides/database/functions

create table public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  question_id text not null check (char_length(question_id) between 5 and 200),
  question_en text not null check (char_length(question_en) between 5 and 200),
  answer_id text not null check (char_length(answer_id) between 5 and 2000),
  answer_en text not null check (char_length(answer_en) between 5 and 2000),
  -- Extra search words in either language ("bayar refund payment").
  keywords text not null default '' check (char_length(keywords) <= 300),
  sort_order integer not null default 0,
  is_published boolean not null default true
);

alter table public.faq_entries enable row level security;
revoke all on table public.faq_entries from anon, authenticated;
grant select on table public.faq_entries to anon, authenticated;
grant insert, update, delete on table public.faq_entries to authenticated;

create policy "Visitors read published FAQ entries"
  on public.faq_entries for select to anon
  using (is_published);
create policy "Users read published FAQ entries, admins every entry"
  on public.faq_entries for select to authenticated
  using (is_published or (select public.is_admin()));
create policy "Admins add FAQ entries"
  on public.faq_entries for insert to authenticated with check ((select public.is_admin()));
create policy "Admins change FAQ entries"
  on public.faq_entries for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete FAQ entries"
  on public.faq_entries for delete to authenticated using ((select public.is_admin()));

-- Published entries matching a keyword in either language, the question first. security invoker, so
-- the policies above still apply; %, _ and \ match literally.
create function public.search_faq(p_query text default null)
returns setof public.faq_entries
language sql
stable
security invoker
set search_path = ''
as $$
  select entry.*
  from public.faq_entries as entry
  where entry.is_published
    and (
      coalesce(btrim(p_query), '') = ''
      or concat_ws(' ', entry.question_id, entry.question_en, entry.answer_id, entry.answer_en, entry.keywords)
        ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by entry.sort_order, entry.question_id;
$$;

grant execute on function public.search_faq(text) to anon, authenticated;

create type public.ticket_status as enum ('open', 'answered', 'closed');
create type public.ticket_urgency as enum ('normal', 'urgent');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  -- The order the question is about, if any (the customer's own; checked by open_ticket).
  order_id uuid references public.orders (id) on delete set null,
  question text not null check (char_length(question) between 5 and 1000),
  urgency public.ticket_urgency not null default 'normal',
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index support_tickets_customer on public.support_tickets (customer_id, created_at desc);
create index support_tickets_inbox on public.support_tickets (status, urgency, created_at);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  -- Who wrote it, as the other side sees it: the customer, or the HomeKlin admin team.
  from_admin boolean not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index ticket_messages_ticket on public.ticket_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
revoke all on table public.support_tickets from anon, authenticated;
revoke all on table public.ticket_messages from anon, authenticated;
-- Read rights only, for Realtime and plain reads; the policies decide which rows.
grant select on table public.support_tickets to authenticated;
grant select on table public.ticket_messages to authenticated;

create policy "Customers read their own tickets, admins every ticket"
  on public.support_tickets for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));

create policy "Messages are read by the ticket's customer and by admins"
  on public.ticket_messages for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.support_tickets as ticket
      where ticket.id = ticket_id and ticket.customer_id = (select auth.uid())
    )
  );

-- A customer escalates a question. Refusals: not_customer, question_invalid, order_not_found.
create function public.open_ticket(p_question text, p_urgency public.ticket_urgency default 'normal', p_order uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := (select auth.uid());
  v_question text := btrim(coalesce(p_question, ''));
  v_ticket uuid;
begin
  if not public.current_role_is('customer') then
    raise exception 'not_customer' using errcode = '42501';
  end if;
  if char_length(v_question) not between 5 and 1000 then
    raise exception 'question_invalid';
  end if;
  if p_order is not null and not exists (select 1 from public.orders where id = p_order and customer_id = v_customer) then
    raise exception 'order_not_found';
  end if;

  insert into public.support_tickets (customer_id, order_id, question, urgency)
  values (v_customer, p_order, v_question, coalesce(p_urgency, 'normal'))
  returning id into v_ticket;

  insert into public.ticket_messages (ticket_id, author_id, from_admin, body)
  values (v_ticket, v_customer, false, v_question);

  return v_ticket;
end;
$$;

-- A message on a ticket, by its customer or by an admin. An admin's message marks the ticket answered,
-- the customer's marks it open again. Refusals: ticket_not_found (also for someone else's ticket),
-- ticket_closed, message_invalid.
create function public.post_ticket_message(p_ticket uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_admin boolean := public.is_admin();
  v_body text := btrim(coalesce(p_body, ''));
  v_ticket record;
  v_message uuid;
begin
  select t.customer_id, t.status into v_ticket from public.support_tickets as t where t.id = p_ticket for update;
  if not found or (not v_admin and v_ticket.customer_id is distinct from v_user) then
    raise exception 'ticket_not_found';
  end if;
  if v_ticket.status = 'closed' then
    raise exception 'ticket_closed';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'message_invalid';
  end if;

  insert into public.ticket_messages (ticket_id, author_id, from_admin, body)
  values (p_ticket, v_user, v_admin, v_body)
  returning id into v_message;

  update public.support_tickets
  set status = case when v_admin then 'answered'::public.ticket_status else 'open'::public.ticket_status end,
      last_message_at = now()
  where id = p_ticket;

  return v_message;
end;
$$;

-- An admin closes a ticket. Refusals: not_admin, ticket_not_found.
create function public.close_ticket(p_ticket uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.support_tickets set status = 'closed' where id = p_ticket;
  if not found then
    raise exception 'ticket_not_found';
  end if;
end;
$$;

-- Admin's inbox: tickets waiting for HomeKlin first (open), urgent before normal, oldest first; then
-- answered and closed ones, latest first. With the customer's name, never their password or e-mail.
create function public.admin_ticket_inbox()
returns table (
  ticket_id uuid,
  customer_name text,
  order_id uuid,
  question text,
  urgency public.ticket_urgency,
  status public.ticket_status,
  created_at timestamptz,
  last_message_at timestamptz,
  message_count bigint
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
    select t.id, p.full_name, t.order_id, t.question, t.urgency, t.status, t.created_at, t.last_message_at,
      (select count(*) from public.ticket_messages as m where m.ticket_id = t.id)
    from public.support_tickets as t
    left join public.profiles as p on p.id = t.customer_id
    order by
      (t.status = 'open') desc,
      (t.urgency = 'urgent' and t.status = 'open') desc,
      case when t.status = 'open' then t.created_at end asc,
      t.last_message_at desc;
end;
$$;

revoke all on function public.open_ticket(text, public.ticket_urgency, uuid) from public, anon;
revoke all on function public.post_ticket_message(uuid, text) from public, anon;
revoke all on function public.close_ticket(uuid) from public, anon;
revoke all on function public.admin_ticket_inbox() from public, anon;
grant execute on function public.open_ticket(text, public.ticket_urgency, uuid) to authenticated;
grant execute on function public.post_ticket_message(uuid, text) to authenticated;
grant execute on function public.close_ticket(uuid) to authenticated;
grant execute on function public.admin_ticket_inbox() to authenticated;

-- Realtime: new messages and ticket status changes reach the subscribed pages.
alter publication supabase_realtime add table public.ticket_messages, public.support_tickets;
