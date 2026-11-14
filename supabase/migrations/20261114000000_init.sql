-- Adaptatic : schéma initial (Supabase / PostgreSQL)
--
-- Flux : l'app écrit un poids (weight_logs) ou un profil (profiles)
--        -> un déclencheur appelle le service Java (pg_net, asynchrone)
--        -> le service recalcule les objectifs et les écrit dans nutrition_targets
--        -> l'app reçoit la mise à jour en temps réel (Supabase Realtime).

-- ---------------------------------------------------------------- Types
create type public.sex            as enum ('male', 'female');
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type public.goal           as enum ('cut', 'maintain', 'bulk');

-- ------------------------------------------------------------- Profils
create table public.profiles (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  sex             public.sex not null,
  birth_date      date not null check (birth_date >= date '1900-01-01'),
  height_cm       numeric(4,1) not null check (height_cm between 100 and 250),
  activity_level  public.activity_level not null default 'moderate',
  goal            public.goal not null default 'maintain',
  -- Vitesse visée, en % du poids de corps par semaine (utilisée pour cut et bulk)
  weekly_rate_pct numeric(3,2) not null default 0.50 check (weekly_rate_pct between 0 and 1.00),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------ Pesées (1 / jour)
create table public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  weight_kg  numeric(5,2) not null check (weight_kg between 30 and 300),
  logged_on  date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index weight_logs_user_date_idx on public.weight_logs (user_id, logged_on desc);

-- --------------------------------------- Objectifs calculés par le service
create table public.nutrition_targets (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  tdee_kcal            integer      not null,
  calories_kcal        integer      not null,
  protein_g            integer      not null,
  carbs_g              integer      not null,
  fat_g                integer      not null,
  -- État de la correction adaptative (voir docs/algorithm.md)
  adaptive_offset_kcal integer      not null default 0,
  tracking_since       date         not null default current_date,
  goal                 public.goal  not null,
  weekly_rate_pct      numeric(3,2) not null,
  weight_trend_kg      numeric(5,2),
  weekly_rate_kg       numeric(4,2),
  note                 text,
  computed_at          timestamptz  not null default now()
);

-- ------------------------------------------------- Sécurité (RLS)
alter table public.profiles          enable row level security;
alter table public.weight_logs       enable row level security;
alter table public.nutrition_targets enable row level security;

create policy "profiles: lecture"      on public.profiles for select using (auth.uid() = user_id);
create policy "profiles: création"     on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles: modification" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "weight_logs: lecture"      on public.weight_logs for select using (auth.uid() = user_id);
create policy "weight_logs: ajout"        on public.weight_logs for insert with check (auth.uid() = user_id);
create policy "weight_logs: modification" on public.weight_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weight_logs: suppression"  on public.weight_logs for delete using (auth.uid() = user_id);

-- Les objectifs sont en lecture seule pour l'utilisateur : seul le service
-- (clé service_role, qui contourne la RLS) peut les écrire.
create policy "nutrition_targets: lecture" on public.nutrition_targets for select using (auth.uid() = user_id);

-- ------------------------------------- Appel du service Java (pg_net)
create extension if not exists pg_net with schema extensions;

-- Schéma privé : invisible depuis l'API publique (anon / authenticated).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_config (
  key   text primary key,
  value text not null
);
revoke all on private.app_config from public, anon, authenticated;

create function private.notify_service() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  service_url text;
  secret      text;
begin
  select value into service_url from private.app_config where key = 'service_url';
  select value into secret      from private.app_config where key = 'webhook_secret';

  -- Service non configuré : on ne bloque pas l'écriture de l'utilisateur.
  if service_url is null or secret is null then
    return new;
  end if;

  perform net.http_post(
    url     := service_url || '/webhooks/supabase',
    body    := jsonb_build_object(
                 'type',   tg_op,
                 'schema', tg_table_schema,
                 'table',  tg_table_name,
                 'record', to_jsonb(new)),
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'X-Webhook-Secret', secret)
  );
  return new;
end;
$$;

create trigger weight_logs_notify
  after insert or update on public.weight_logs
  for each row execute function private.notify_service();

create trigger profiles_notify
  after insert or update on public.profiles
  for each row execute function private.notify_service();

-- ------------------------------------------------ Temps réel pour l'app
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.nutrition_targets;
  end if;
end;
$$;
