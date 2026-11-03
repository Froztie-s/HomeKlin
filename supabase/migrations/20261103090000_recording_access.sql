-- T14: who may replay a recording. SPEC: the customer who booked the job (most important), the agency
-- the job was routed to, and admin. Nobody else.
-- recording_for_viewer() runs as the signed-in viewer (auth.uid()). It returns where the file is only to
-- those three, and only while the recording has not expired; the server then signs a short-lived link
-- with the secret key (src/lib/recordings/link.ts). The bucket and the table stay closed
-- (20261101090000_recordings.sql), so this check is the only way to a file.
-- Anyone without the right gets recording_not_found, the same as for an id that does not exist, so they
-- cannot tell that the recording exists or has expired. Those with the right learn it has expired.
-- Source: https://supabase.com/docs/guides/database/functions (security definer, search_path)

create function public.recording_for_viewer(p_recording uuid)
returns table (file_path text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_recording record;
begin
  select r.file_path, r.expires_at into v_recording
  from public.recordings as r
  join public.orders as o on o.id = r.order_id
  where r.id = p_recording
    and (
      o.customer_id = (select auth.uid())
      or exists (
        select 1 from public.agencies as a
        where a.id = r.agency_id and a.user_id = (select auth.uid())
      )
      or public.is_admin()
    );

  if not found then
    raise exception 'recording_not_found';
  end if;

  if v_recording.expires_at <= now() then
    raise exception 'recording_expired';
  end if;

  return query select v_recording.file_path, v_recording.expires_at;
end;
$$;

revoke all on function public.recording_for_viewer(uuid) from public, anon;
grant execute on function public.recording_for_viewer(uuid) to authenticated;
