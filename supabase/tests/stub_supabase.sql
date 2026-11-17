-- Reproduit le strict minimum de Supabase pour tester les migrations sur un PostgreSQL nu.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create schema net;
create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql as 'select 0::bigint';
create publication supabase_realtime;

-- Comme Supabase : les nouvelles tables de public sont ouvertes à tous les rôles (la RLS protège).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
