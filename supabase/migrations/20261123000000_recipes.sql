-- Recettes : un aliment composite calculé par la base à partir de ses ingrédients
-- (jamais un chiffre envoyé par le client), stocké comme un aliment normal
-- (source = 'recipe') pour réutiliser tout ce qui existe déjà (recherche, ajout
-- au journal, portions). Voir docs/algorithm.md.

-- Le poids final est ce que l'utilisateur a pesé après cuisson, pas la somme des
-- ingrédients : l'eau s'évapore, le riz en absorbe. Les kcal totales, elles, ne
-- changent pas à la cuisson (conservation de l'énergie) — seule la densité
-- kcal/100g dépend du poids final.
alter table public.foods add column recipe_yield_g numeric(7,1) check (recipe_yield_g > 0 and recipe_yield_g <= 20000);
alter table public.foods add column recipe_portions integer check (recipe_portions between 1 and 50);

alter table public.foods drop constraint foods_source_check;
alter table public.foods add constraint foods_source_check
  check (source in ('user', 'openfoodfacts', 'ciqual', 'recipe'));

drop policy "foods: création" on public.foods;
create policy "foods: création" on public.foods for insert
  with check (owner_id = auth.uid() and source in ('user', 'recipe'));

-- --------------------------------------------- Composition (pour affichage)
-- Pas de modification après coup en v1 : pour changer un ingrédient, on recrée
-- la recette. ingredient_name est une copie (même principe que meal_entries) :
-- si l'ingrédient est supprimé plus tard, la composition reste lisible.
create table public.recipe_ingredients (
  id                 uuid primary key default gen_random_uuid(),
  recipe_food_id     uuid not null references public.foods (id) on delete cascade,
  ingredient_food_id uuid references public.foods (id) on delete set null,
  ingredient_name    text not null,
  grams              numeric(7,1) not null check (grams > 0 and grams <= 10000),
  created_at         timestamptz not null default now()
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_food_id);

alter table public.recipe_ingredients enable row level security;

create policy "recipe_ingredients: lecture" on public.recipe_ingredients for select
  using (exists (select 1 from public.foods f where f.id = recipe_food_id and f.owner_id = auth.uid()));
create policy "recipe_ingredients: création" on public.recipe_ingredients for insert
  with check (exists (select 1 from public.foods f where f.id = recipe_food_id and f.owner_id = auth.uid()));
create policy "recipe_ingredients: suppression" on public.recipe_ingredients for delete
  using (exists (select 1 from public.foods f where f.id = recipe_food_id and f.owner_id = auth.uid()));

revoke all on public.recipe_ingredients from anon;
grant select, insert, delete on public.recipe_ingredients to authenticated;

-- ------------------------------------------------------- Création atomique
-- security invoker (par défaut) : la RLS s'applique à chaque lecture/écriture.
-- Un ingrédient que l'appelant ne peut pas lire (aliment privé d'un autre
-- utilisateur) ne matche simplement pas la jointure -> rejeté plus bas.
create function public.create_recipe(
  p_name text,
  p_ingredients jsonb, -- [{"food_id": "...", "grams": 123}, ...]
  p_yield_g numeric,
  p_portions integer default null
) returns public.foods
language plpgsql
set search_path = ''
as $$
declare
  new_food public.foods;
  totals record;
  n_ingredients integer;
begin
  select count(*) into n_ingredients from jsonb_array_elements(p_ingredients);
  if n_ingredients < 1 then
    raise exception 'Une recette a besoin d''au moins un ingrédient' using errcode = '23514';
  end if;
  if p_yield_g is null or p_yield_g <= 0 then
    raise exception 'Poids du plat fini requis' using errcode = '23514';
  end if;

  select
    coalesce(sum(i.grams * f.kcal_100) / 100, 0)    as kcal,
    coalesce(sum(i.grams * f.protein_100) / 100, 0) as protein,
    coalesce(sum(i.grams * f.carbs_100) / 100, 0)   as carbs,
    coalesce(sum(i.grams * f.fat_100) / 100, 0)     as fat,
    count(*)                                        as matched
  into totals
  from jsonb_to_recordset(p_ingredients) as i(food_id uuid, grams numeric)
  join public.foods f on f.id = i.food_id;

  if totals.matched is null or totals.matched < n_ingredients then
    raise exception 'Un ingrédient est introuvable' using errcode = '23503';
  end if;

  insert into public.foods (owner_id, name, kcal_100, protein_100, carbs_100, fat_100,
                             serving_g, serving_label, source, recipe_yield_g, recipe_portions)
  values (auth.uid(), p_name,
          round(totals.kcal    / p_yield_g * 100, 1),
          round(totals.protein / p_yield_g * 100, 1),
          round(totals.carbs   / p_yield_g * 100, 1),
          round(totals.fat     / p_yield_g * 100, 1),
          case when p_portions is not null then round(p_yield_g / p_portions, 1) end,
          case when p_portions is not null then '1 portion' end,
          'recipe', p_yield_g, p_portions)
  returning * into new_food;

  insert into public.recipe_ingredients (recipe_food_id, ingredient_food_id, ingredient_name, grams)
  select new_food.id, f.id, f.name, i.grams
  from jsonb_to_recordset(p_ingredients) as i(food_id uuid, grams numeric)
  join public.foods f on f.id = i.food_id;

  return new_food;
end;
$$;

revoke all on function public.create_recipe(text, jsonb, numeric, integer) from public, anon;
grant execute on function public.create_recipe(text, jsonb, numeric, integer) to authenticated;
