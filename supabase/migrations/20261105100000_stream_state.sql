-- T22 follow-up: the cleaner can read the state of their own stream. stream_for_viewer() refuses cleaners
-- on purpose (they publish, they do not watch), so until now the cleaner's page could only remember the
-- state per browser tab. my_stream_status() answers for the job's own cleaner and nobody else: the
-- stream's status, or null when the job has no stream (or it is another cleaner's job: the same answer,
-- so nothing can be probed). Refusal: not_cleaner.

create function public.my_stream_status(p_order uuid)
returns public.stream_status
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status public.stream_status;
begin
  if not public.current_role_is('cleaner') then
    raise exception 'not_cleaner' using errcode = '42501';
  end if;

  select s.status into v_status
  from public.stream_sessions as s
  where s.order_id = p_order and s.cleaner_id = (select auth.uid());

  return v_status;
end;
$$;

revoke all on function public.my_stream_status(uuid) from public, anon;
grant execute on function public.my_stream_status(uuid) to authenticated;
