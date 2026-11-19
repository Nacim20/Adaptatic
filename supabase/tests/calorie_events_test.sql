-- Tests de l'imprévu : RLS et règle "un seul imprévu actif à la fois".
-- Suppose que tests/food_journal_test.sql a déjà tourné dans la même base
-- (schéma t et utilisateurs alice/bob déjà créés) : voir tests/run.sh.

do $$
declare
  alice uuid := '00000000-0000-0000-0000-00000000000a';
  bob   uuid := '00000000-0000-0000-0000-00000000000b';
  n int;
begin
  -- -------------------------------------------- Alice déclare un imprévu
  perform t.as_user(alice);
  insert into public.calorie_events (user_id, event_date, excess_kcal) values (alice, current_date, 800);

  select count(*) into n from public.calorie_events where user_id = alice;
  perform t.assert(n = 1, 'Alice voit son imprévu');

  -- --------------------------------------------- Un seul actif à la fois
  perform t.fails(format($q$insert into public.calorie_events (user_id, event_date, excess_kcal) values (%L, current_date, 500)$q$, alice),
    'un 2e imprévu actif doit être refusé');

  -- -------------------------------------------------- Contraintes de données
  perform t.fails(format($q$insert into public.calorie_events (user_id, event_date, excess_kcal) values (%L, current_date + 1, 500)$q$, alice),
    'un imprévu dans le futur doit être refusé');
  perform t.fails(format($q$insert into public.calorie_events (user_id, event_date, excess_kcal) values (%L, current_date, 0)$q$, alice),
    'un écart de 0 kcal doit être refusé');
  perform t.fails(format($q$insert into public.calorie_events (user_id, event_date, excess_kcal) values (%L, current_date, 5001)$q$, alice),
    'un écart au-delà de 5000 kcal doit être refusé');

  -- --------------------------------------------------------- Droits : Bob
  perform t.as_admin();
  perform t.as_user(bob);
  select count(*) into n from public.calorie_events;
  perform t.assert(n = 0, 'Bob ne voit pas l''imprévu d''Alice');
  perform t.fails(format($q$insert into public.calorie_events (user_id, event_date, excess_kcal) values (%L, current_date, 500)$q$, alice),
    'Bob ne peut pas déclarer un imprévu au nom d''Alice');
  delete from public.calorie_events where user_id = alice;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'Bob ne peut pas annuler l''imprévu d''Alice');

  -- -------------------------------------------------------- Anonyme : rien
  perform t.as_admin();
  perform t.as_anon();
  perform t.fails('select * from public.calorie_events', 'anon ne lit pas calorie_events');
  perform t.fails(format($q$insert into public.calorie_events (user_id, event_date, excess_kcal) values (%L, current_date, 500)$q$, bob),
    'anon ne peut pas déclarer un imprévu');

  -- ---------------------------------- Annuler puis déclarer un nouvel imprévu
  perform t.as_admin();
  perform t.as_user(alice);
  delete from public.calorie_events where user_id = alice;
  insert into public.calorie_events (user_id, event_date, excess_kcal) values (alice, current_date, 300);
  select count(*) into n from public.calorie_events where user_id = alice;
  perform t.assert(n = 1, 'un nouvel imprévu est accepté après annulation du précédent');

  perform t.as_admin();
  raise notice 'calorie_events_test : tous les tests passent';
end $$;
