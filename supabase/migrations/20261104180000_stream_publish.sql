-- T31: who may publish a job's live video. Only the job's own cleaner, while the job is in progress
-- (checked in, not completed) and the customer consented: the same rule as start_stream()
-- (20261104140000_streams.sql). The LiveKit token endpoint (src/app/api/streams/[orderId]/token) asks
-- this before it signs a publishing token; viewers are checked with stream_for_viewer().

create function public.can_publish_stream(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_role_is('cleaner') and exists (
    select 1 from public.orders as o
    where o.id = p_order
      and o.cleaner_id = (select auth.uid())
      and o.status = 'paid'
      and o.checked_in_at is not null
      and o.completed_at is null
      and o.stream_consent
  );
$$;

revoke all on function public.can_publish_stream(uuid) from public, anon;
grant execute on function public.can_publish_stream(uuid) to authenticated;
