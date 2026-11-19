-- Imprévu (v1) : l'utilisateur déclare un écart calorique estimé par lui-même
-- (jamais une valeur inventée par l'app), que le service lisse sur les jours
-- suivants. Voir docs/algorithm.md §8.

create table public.calorie_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  event_date  date not null check (event_date <= current_date),
  excess_kcal integer not null check (excess_kcal between 1 and 5000),
  created_at  timestamptz not null default now()
);

create index calorie_events_user_date_idx on public.calorie_events (user_id, event_date desc);

alter table public.calorie_events enable row level security;

create policy "calorie_events: lecture"    on public.calorie_events for select using (auth.uid() = user_id);
create policy "calorie_events: création"   on public.calorie_events for insert with check (auth.uid() = user_id);
create policy "calorie_events: suppression" on public.calorie_events for delete using (auth.uid() = user_id);

revoke all on public.calorie_events from anon;

-- Un seul imprévu actif à la fois : refuse un nouvel imprévu tant qu'un
-- précédent est encore dans sa fenêtre de lissage. 10 jours = la constante
-- EVENT_MAX_SPREAD_DAYS du moteur (service/.../engine/EventSpread.java) :
-- fenêtre large et conservatrice, pas le calcul exact (qui dépend du montant
-- de l'écart) — gardée volontairement simple côté base.
create function private.calorie_events_single_active() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.calorie_events
    where user_id = new.user_id and event_date >= current_date - 10
  ) then
    raise exception 'Un imprévu est déjà en cours pour cet utilisateur';
  end if;
  return new;
end;
$$;

create trigger calorie_events_single_active
  before insert on public.calorie_events
  for each row execute function private.calorie_events_single_active();

-- ---------------------------------------- Webhook : accepte aussi DELETE
-- (annuler un imprévu doit relancer le calcul immédiatement). new n'existe
-- pas en delete : on envoie old à la place.
create or replace function private.notify_service() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  service_url text;
  secret      text;
  row_data    record;
begin
  select value into service_url from private.app_config where key = 'service_url';
  select value into secret      from private.app_config where key = 'webhook_secret';

  if service_url is null or secret is null then
    return coalesce(new, old);
  end if;

  row_data := coalesce(new, old);
  perform net.http_post(
    url     := service_url || '/webhooks/supabase',
    body    := jsonb_build_object(
                 'type',   tg_op,
                 'schema', tg_table_schema,
                 'table',  tg_table_name,
                 'record', to_jsonb(row_data)),
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'X-Webhook-Secret', secret)
  );
  return row_data;
end;
$$;

create trigger calorie_events_notify
  after insert or delete on public.calorie_events
  for each row execute function private.notify_service();

-- ------------------------------------------- Effet affiché sur l'objectif
alter table public.nutrition_targets
  add column event_offset_kcal integer not null default 0;
