-- Tests du journal alimentaire : calculs côté base et isolation entre utilisateurs (RLS).
create schema t;
grant usage on schema t to public;

create function t.assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'ÉCHEC : %', msg; end if;
end $$;

-- Exécute une requête qui DOIT échouer (droit refusé, contrainte, RLS...).
create function t.fails(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    return;
  end;
  raise exception 'ÉCHEC (aurait dû être refusé) : %', msg;
end $$;

create function t.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, true);
  execute 'set local role authenticated';
end $$;

create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

create function t.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
end $$;

do $$
declare
  alice uuid := '00000000-0000-0000-0000-00000000000a';
  bob   uuid := '00000000-0000-0000-0000-00000000000b';
  shared_id uuid;
  cream_id uuid;
  alice_food uuid;
  entry_id uuid;
  n int;
  e public.meal_entries;
begin
  insert into auth.users (id) values (alice), (bob);
  -- Catalogue partagé (écrit par le service, donc hors RLS).
  insert into public.foods (owner_id, name, kcal_100, protein_100, carbs_100, fat_100, source)
    values (null, 'Riz blanc cuit', 130, 2.7, 28, 0.3, 'ciqual') returning id into shared_id;

  -- ---------------------------------------------------- Alice crée un aliment
  perform t.as_user(alice);
  insert into public.foods (owner_id, name, kcal_100, protein_100, carbs_100, fat_100, serving_g, serving_label)
    values (alice, 'Crème fraîche épaisse', 200, 2.5, 3, 20, 30, '1 cuillère') returning id into cream_id;
  insert into public.foods (owner_id, name, kcal_100, protein_100, carbs_100, fat_100)
    values (alice, 'Poulet grillé', 165, 31, 0, 3.6) returning id into alice_food;

  -- Contraintes de données
  perform t.fails(format($q$insert into public.foods (owner_id, name, kcal_100, protein_100, carbs_100, fat_100) values (%L, 'X', 100, 60, 60, 10)$q$, alice),
    'macros > 100 g pour 100 g');
  perform t.fails(format($q$insert into public.foods (owner_id, name, kcal_100, protein_100, carbs_100, fat_100) values (%L, 'X', -1, 1, 1, 1)$q$, alice),
    'kcal négatives');
  perform t.fails(format($q$insert into public.foods (owner_id, name, barcode, kcal_100, protein_100, carbs_100, fat_100) values (%L, 'X', 'abc', 1, 1, 1, 1)$q$, alice),
    'code-barres invalide');
  -- Droits : pas d'aliment partagé, pas d'aliment au nom d'un autre
  perform t.fails($q$insert into public.foods (owner_id, name, kcal_100, protein_100, carbs_100, fat_100) values (null, 'Partagé pirate', 1, 1, 1, 1)$q$,
    'un utilisateur ne peut pas écrire dans le catalogue partagé');
  perform t.fails(format($q$insert into public.foods (owner_id, name, kcal_100, protein_100, carbs_100, fat_100) values (%L, 'Usurpé', 1, 1, 1, 1)$q$, bob),
    'créer un aliment au nom de Bob');
  -- Modifier un aliment partagé : 0 ligne touchée
  update public.foods set kcal_100 = 1 where id = shared_id;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'Alice ne doit pas pouvoir modifier le catalogue partagé');

  -- ------------------------------------------ Entrée : copie calculée en base
  insert into public.meal_entries (user_id, eaten_on, meal, food_id, food_name, quantity_g, kcal, protein_g, carbs_g, fat_g)
    values (alice, '2026-11-15', 'lunch', cream_id, 'valeur du client ignorée', 150, 99999, 0, 0, 0)
    returning * into e;
  perform t.assert(e.kcal = 300.0 and e.protein_g = 3.8 and e.carbs_g = 4.5 and e.fat_g = 30.0,
    format('150 g de crème : attendu 300/3.8/4.5/30, obtenu %s/%s/%s/%s', e.kcal, e.protein_g, e.carbs_g, e.fat_g));
  perform t.assert(e.food_name = 'Crème fraîche épaisse', 'le nom vient de l''aliment, pas du client');
  entry_id := e.id;

  perform t.fails(format($q$insert into public.meal_entries (user_id, eaten_on, meal, food_id, food_name, quantity_g, kcal, protein_g, carbs_g, fat_g) values (%L, '2026-11-15', 'lunch', %L, 'x', 0, 0, 0, 0, 0)$q$, alice, cream_id),
    'quantité 0');
  perform t.fails(format($q$insert into public.meal_entries (user_id, eaten_on, meal, food_id, food_name, quantity_g, kcal, protein_g, carbs_g, fat_g) values (%L, '2026-11-15', 'lunch', null, 'x', 100, 1, 1, 1, 1)$q$, alice),
    'entrée sans aliment');
  perform t.fails(format($q$insert into public.meal_entries (user_id, eaten_on, meal, food_id, food_name, quantity_g, kcal, protein_g, carbs_g, fat_g) values (%L, '2026-11-15', 'lunch', %L, 'x', 100, 1, 1, 1, 1)$q$, bob, cream_id),
    'écrire une entrée au nom de Bob');

  -- Modifier la quantité recalcule
  update public.meal_entries set quantity_g = 30 where id = entry_id returning * into e;
  perform t.assert(e.kcal = 60.0, 'quantité modifiée : 30 g de crème = 60 kcal');

  -- Eau
  insert into public.water_logs (user_id, logged_on, amount_ml) values (alice, '2026-11-15', 250);
  perform t.fails(format($q$insert into public.water_logs (user_id, logged_on, amount_ml) values (%L, '2026-11-15', 0)$q$, alice), 'eau 0 ml');
  perform t.fails(format($q$insert into public.water_logs (user_id, logged_on, amount_ml) values (%L, '2026-11-15', 99999)$q$, alice), 'eau 99 L');

  -- ------------------------------------------------------------- Recherche
  select count(*) into n from public.search_foods('creme');
  perform t.assert(n = 1, 'recherche sans accent : "creme" trouve "Crème fraîche"');
  select count(*) into n from public.search_foods('FRAICHE epaisse');
  perform t.assert(n = 1, 'recherche multi-mots, casse et accents ignorés');
  select count(*) into n from public.search_foods('riz');
  perform t.assert(n = 1, 'Alice voit le catalogue partagé');
  select count(*) into n from public.search_foods('%');
  perform t.assert(n = 0, 'le joker % est échappé (et < 2 caractères : rien)');
  select count(*) into n from public.search_foods('c%');
  perform t.assert(n = 0, '"c%" ne doit pas agir comme un joker');
  select count(*) into n from public.search_foods('zzzz');
  perform t.assert(n = 0, 'aucun résultat inventé');

  -- ------------------------------------------------ Bob ne voit rien d'Alice
  perform t.as_admin();
  perform t.as_user(bob);
  select count(*) into n from public.foods where owner_id = alice;
  perform t.assert(n = 0, 'Bob ne voit pas les aliments d''Alice');
  select count(*) into n from public.meal_entries;
  perform t.assert(n = 0, 'Bob ne voit pas les entrées d''Alice');
  select count(*) into n from public.water_logs;
  perform t.assert(n = 0, 'Bob ne voit pas l''eau d''Alice');
  select count(*) into n from public.search_foods('creme');
  perform t.assert(n = 0, 'la recherche de Bob ne renvoie pas les aliments d''Alice');
  select count(*) into n from public.search_foods('riz');
  perform t.assert(n = 1, 'Bob voit le catalogue partagé');

  perform t.fails(format($q$insert into public.meal_entries (user_id, eaten_on, meal, food_id, food_name, quantity_g, kcal, protein_g, carbs_g, fat_g) values (%L, '2026-11-15', 'lunch', %L, 'x', 100, 1, 1, 1, 1)$q$, bob, cream_id),
    'Bob ne peut pas utiliser l''aliment privé d''Alice');
  update public.meal_entries set quantity_g = 999 where id = entry_id;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'Bob ne peut pas modifier l''entrée d''Alice');
  delete from public.meal_entries where id = entry_id;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'Bob ne peut pas supprimer l''entrée d''Alice');
  delete from public.foods where id = cream_id;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'Bob ne peut pas supprimer l''aliment d''Alice');

  -- ------------------------------------------------------- Anonyme : rien
  perform t.as_admin();
  perform t.as_anon();
  perform t.fails('select * from public.foods', 'anon ne lit pas foods');
  perform t.fails('select * from public.meal_entries', 'anon ne lit pas meal_entries');
  perform t.fails('select * from public.water_logs', 'anon ne lit pas water_logs');
  perform t.fails($q$select * from public.search_foods('riz')$q$, 'anon ne peut pas chercher');

  -- ------------------- Supprimer un aliment garde l'historique (copie nutritionnelle)
  perform t.as_admin();
  perform t.as_user(alice);
  delete from public.foods where id = cream_id;
  select * into e from public.meal_entries where id = entry_id;
  perform t.assert(e.food_id is null and e.food_name = 'Crème fraîche épaisse' and e.kcal = 60.0,
    'l''entrée garde son nom et ses kcal après suppression de l''aliment');
  update public.meal_entries set meal = 'dinner' where id = entry_id;
  select * into e from public.meal_entries where id = entry_id;
  perform t.assert(e.meal = 'dinner' and e.kcal = 60.0, 'une entrée orpheline reste modifiable sans perdre ses valeurs');

  perform t.as_admin();
  raise notice 'food_journal_test : tous les tests passent';
end $$;
