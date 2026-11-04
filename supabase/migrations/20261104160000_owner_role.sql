-- T29b: the owner of HomeKlin is a role of its own. A value added to an enum cannot be used in the same
-- transaction that adds it, so this migration does only this; 20261104160100_owner.sql uses it.
-- Nobody becomes an owner by signing up: handle_new_user() always makes a customer, and only the
-- secret key changes a role (20261022120000_profiles_and_roles.sql).
-- Source: https://www.postgresql.org/docs/current/sql-altertype.html (Notes)

alter type public.app_role add value if not exists 'owner';
