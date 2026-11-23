-- Tests des recettes : calcul par la base, RLS, isolation entre utilisateurs.
-- Suppose que tests/food_journal_test.sql a déjà tourné (schéma t, alice/bob,
-- catalogue partagé "Riz blanc cuit") : voir tests/run.sh.

do $$
declare
  alice uuid := '00000000-0000-0000-0000-00000000000a';
  bob   uuid := '00000000-0000-0000-0000-00000000000b';
  rice_id uuid;
  chicken_id uuid;
  recipe public.foods;
  n int;
begin
  perform t.as_user(alice);
  select id into rice_id from public.foods where name = 'Riz blanc cuit' and owner_id is null;
  insert into public.foods (owner_id, name, kcal_100, protein_100, carbs_100, fat_100)
    values (alice, 'Poulet maison', 165, 31, 0, 3.6) returning id into chicken_id;

  -- 200 g riz (130 kcal/100g) + 150 g poulet (165 kcal/100g), poids fini pesé 300 g :
  -- (200*1.30 + 150*1.65) / 300 * 100 = 169.17 -> 169.2 kcal/100g
  select * into recipe from public.create_recipe(
    'Riz au poulet',
    jsonb_build_array(
      jsonb_build_object('food_id', rice_id, 'grams', 200),
      jsonb_build_object('food_id', chicken_id, 'grams', 150)
    ),
    300, 2
  );
  perform t.assert(recipe.source = 'recipe', 'la recette a source=recipe');
  perform t.assert(recipe.owner_id = alice, 'la recette appartient à Alice');
  perform t.assert(recipe.kcal_100 = 169.2, format('kcal_100 attendu 169.2, obtenu %s', recipe.kcal_100));
  perform t.assert(recipe.protein_100 = 17.3, format('protein_100 attendu 17.3, obtenu %s', recipe.protein_100));
  perform t.assert(recipe.serving_g = 150.0, 'portion = poids fini / nb de portions (300/2)');

  select count(*) into n from public.recipe_ingredients where recipe_food_id = recipe.id;
  perform t.assert(n = 2, 'les deux ingrédients sont enregistrés');

  -- Utilisable comme un aliment normal (recherche, journal)
  select count(*) into n from public.search_foods('riz au poulet');
  perform t.assert(n = 1, 'la recette apparaît dans la recherche');

  -- ------------------------------------------------------------ Contraintes
  perform t.fails($q$select public.create_recipe('Vide', '[]'::jsonb, 100, null)$q$,
    'une recette sans ingrédient doit être refusée');
  perform t.fails(format($q$select public.create_recipe('Sans poids', jsonb_build_array(jsonb_build_object('food_id', %L, 'grams', 100)), null, null)$q$, rice_id),
    'une recette sans poids final doit être refusée');

  -- -------------------------------------------------------------- Droits
  perform t.as_admin();
  perform t.as_user(bob);

  perform t.fails(format($q$select public.create_recipe('Vol', jsonb_build_array(jsonb_build_object('food_id', %L, 'grams', 100)), 100, null)$q$, chicken_id),
    'Bob ne peut pas utiliser un ingrédient privé d''Alice (il ne le voit pas)');

  select count(*) into n from public.foods where id = recipe.id;
  perform t.assert(n = 0, 'Bob ne voit pas la recette privée d''Alice');
  select count(*) into n from public.recipe_ingredients where recipe_food_id = recipe.id;
  perform t.assert(n = 0, 'Bob ne voit pas la composition de la recette d''Alice');

  delete from public.recipe_ingredients where recipe_food_id = recipe.id;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'Bob ne peut pas supprimer la composition de la recette d''Alice');
  delete from public.foods where id = recipe.id;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'Bob ne peut pas supprimer la recette d''Alice');

  -- ------------------------------------------------------------- Anonyme
  perform t.as_admin();
  perform t.as_anon();
  perform t.fails('select * from public.recipe_ingredients', 'anon ne lit pas recipe_ingredients');
  perform t.fails(format($q$select public.create_recipe('Anon', jsonb_build_array(jsonb_build_object('food_id', %L, 'grams', 100)), 100, null)$q$, rice_id),
    'anon ne peut pas créer de recette');

  perform t.as_admin();
  raise notice 'recipes_test : tous les tests passent';
end $$;
