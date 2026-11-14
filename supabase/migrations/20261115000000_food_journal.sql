-- Journal alimentaire : aliments (par 100 g), entrées de repas, eau.
-- Règle : RLS activée avec ses politiques dans la même migration, droits explicites.

create extension if not exists unaccent with schema extensions;

create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');

-- Objectif d'eau (boissons), en ml. Défaut indicatif, modifiable par l'utilisateur.
alter table public.profiles
  add column water_target_ml integer not null default 2000
  check (water_target_ml between 500 and 10000);

-- ------------------------------------------------------------- Aliments
-- Valeurs pour 100 g. owner_id NULL = catalogue partagé (écrit uniquement par le service) ;
-- sinon l'aliment appartient à l'utilisateur.
create table public.foods (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 120),
  brand         text check (length(brand) <= 80),
  barcode       text check (barcode ~ '^[0-9]{8,14}$'),
  kcal_100      numeric(5,1) not null check (kcal_100 between 0 and 900),
  protein_100   numeric(4,1) not null check (protein_100 between 0 and 100),
  carbs_100     numeric(4,1) not null check (carbs_100 between 0 and 100),
  fat_100       numeric(4,1) not null check (fat_100 between 0 and 100),
  serving_g     numeric(6,1) check (serving_g > 0 and serving_g <= 5000),
  serving_label text check (length(serving_label) <= 40),
  source        text not null default 'user' check (source in ('user', 'openfoodfacts', 'ciqual')),
  created_at    timestamptz not null default now(),
  -- Les macros ne peuvent pas dépasser 100 g pour 100 g (petite tolérance : arrondis d'étiquettes).
  check (protein_100 + carbs_100 + fat_100 <= 101)
);

create index foods_owner_idx on public.foods (owner_id);
create unique index foods_barcode_shared_idx on public.foods (barcode)
  where owner_id is null and barcode is not null;
create unique index foods_barcode_owner_idx on public.foods (owner_id, barcode)
  where owner_id is not null and barcode is not null;

-- ------------------------------------------------------ Entrées de repas
-- Les valeurs nutritionnelles sont une COPIE calculée à l'enregistrement : l'historique
-- ne change pas si l'aliment est modifié ou supprimé plus tard.
create table public.meal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  eaten_on    date not null,
  meal        public.meal_type not null,
  food_id     uuid references public.foods (id) on delete set null,
  food_name   text not null,
  quantity_g  numeric(7,1) not null check (quantity_g > 0 and quantity_g <= 10000),
  kcal        numeric(7,1) not null check (kcal >= 0),
  protein_g   numeric(6,1) not null check (protein_g >= 0),
  carbs_g     numeric(6,1) not null check (carbs_g >= 0),
  fat_g       numeric(6,1) not null check (fat_g >= 0),
  created_at  timestamptz not null default now()
);

create index meal_entries_user_day_idx on public.meal_entries (user_id, eaten_on);
create index meal_entries_user_recent_idx on public.meal_entries (user_id, created_at desc);

-- Calcule la copie nutritionnelle depuis l'aliment (le client ne peut pas la falsifier).
create function public.meal_entries_snapshot() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  f public.foods;
begin
  -- Mise à jour déclenchée par la suppression de l'aliment (food_id -> NULL) : on garde la copie.
  if new.food_id is null and tg_op = 'UPDATE' then
    return new;
  end if;
  if new.food_id is null then
    raise exception 'Aliment requis' using errcode = '23502';
  end if;

  -- Sous RLS : un aliment d'un autre utilisateur n'est pas visible, donc refusé ici.
  select * into f from public.foods where id = new.food_id;
  if not found then
    raise exception 'Aliment introuvable' using errcode = '23503';
  end if;

  new.food_name := f.name;
  new.kcal      := round(f.kcal_100    * new.quantity_g / 100, 1);
  new.protein_g := round(f.protein_100 * new.quantity_g / 100, 1);
  new.carbs_g   := round(f.carbs_100   * new.quantity_g / 100, 1);
  new.fat_g     := round(f.fat_100     * new.quantity_g / 100, 1);
  return new;
end;
$$;

create trigger meal_entries_snapshot
  before insert or update on public.meal_entries
  for each row execute function public.meal_entries_snapshot();

-- ------------------------------------------------------------------ Eau
create table public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  logged_on  date not null,
  amount_ml  integer not null check (amount_ml between 1 and 3000),
  created_at timestamptz not null default now()
);

create index water_logs_user_day_idx on public.water_logs (user_id, logged_on);

-- --------------------------------------------------------------- Sécurité
alter table public.foods        enable row level security;
alter table public.meal_entries enable row level security;
alter table public.water_logs   enable row level security;

-- Aliments : lecture du catalogue partagé + des siens ; écriture des siens uniquement.
create policy "foods: lecture" on public.foods for select
  using (owner_id is null or owner_id = auth.uid());
create policy "foods: création" on public.foods for insert
  with check (owner_id = auth.uid() and source = 'user');
create policy "foods: modification" on public.foods for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and source = 'user');
create policy "foods: suppression" on public.foods for delete
  using (owner_id = auth.uid());

create policy "meal_entries: lecture"      on public.meal_entries for select using (auth.uid() = user_id);
create policy "meal_entries: ajout"        on public.meal_entries for insert with check (auth.uid() = user_id);
create policy "meal_entries: modification" on public.meal_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_entries: suppression"  on public.meal_entries for delete using (auth.uid() = user_id);

create policy "water_logs: lecture"     on public.water_logs for select using (auth.uid() = user_id);
create policy "water_logs: ajout"       on public.water_logs for insert with check (auth.uid() = user_id);
create policy "water_logs: suppression" on public.water_logs for delete using (auth.uid() = user_id);

-- Droits explicites (ne pas dépendre des droits par défaut du projet) : rien pour anon.
revoke all on public.foods, public.meal_entries, public.water_logs from anon;
grant select, insert, update, delete on public.foods, public.meal_entries to authenticated;
grant select, insert, delete on public.water_logs to authenticated;

-- ------------------------------------------------------------- Recherche
-- Recherche insensible aux accents et à la casse ; tous les mots doivent être présents.
-- security invoker : la RLS s'applique (catalogue partagé + aliments de l'utilisateur).
create function public.search_foods(q text, max_results integer default 30)
returns setof public.foods
language sql stable
set search_path = ''
as $$
  select f.*
  from public.foods f
  where length(btrim(q)) >= 2
    and not exists (
      select 1
      from unnest(string_to_array(btrim(q), ' ')) as w
      where w <> ''
        and extensions.unaccent(lower(f.name || ' ' || coalesce(f.brand, '')))
            not like '%' || replace(replace(replace(extensions.unaccent(lower(w)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by (f.owner_id is not null) desc, length(f.name), f.name
  limit least(greatest(max_results, 1), 50)
$$;

revoke all on function public.search_foods(text, integer) from public, anon;
grant execute on function public.search_foods(text, integer) to authenticated;
