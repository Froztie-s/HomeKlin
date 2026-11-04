-- T28: the photo an agency adds for each of its cleaners, shown to the customer next to "Petugas
-- HomeKlin". A public bucket, because the photo is shown on the customer's pages anyway; nobody writes
-- to it except the server (src/lib/agency/actions.ts uploads with the secret key after checking the
-- agency), since there are no storage policies for users. Images only, at most 2 MB.
-- Source: https://supabase.com/docs/guides/storage/buckets/fundamentals ("Public buckets")

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cleaner-photos', 'cleaner-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);
