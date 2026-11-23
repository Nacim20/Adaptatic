-- Tests du suivi d'entraînement : RLS et isolation entre utilisateurs.
-- Suppose que tests/food_journal_test.sql a déjà tourné (schéma t, alice/bob) :
-- voir tests/run.sh.

do $$
declare
  alice uuid := '00000000-0000-0000-0000-00000000000a';
  bob   uuid := '00000000-0000-0000-0000-00000000000b';
  bench_id uuid;
  sess_id uuid;
  n int;
begin
  perform t.as_user(alice);

  insert into public.exercises (owner_id, name) values (alice, 'Développé couché') returning id into bench_id;

  insert into public.workout_split_days (user_id, weekday, label) values (alice, 4, 'Push');
  update public.workout_split_days set label = 'Push (haut du corps)' where user_id = alice and weekday = 4;

  insert into public.workout_sessions (user_id, performed_on, label) values (alice, current_date, 'Push') returning id into sess_id;
  insert into public.workout_sets (session_id, exercise_id, exercise_name, weight_kg, reps, set_order)
    values (sess_id, bench_id, 'Développé couché', 60, 8, 1),
           (sess_id, bench_id, 'Développé couché', 60, 8, 2);

  select count(*) into n from public.workout_sets where session_id = sess_id;
  perform t.assert(n = 2, 'les deux séries sont enregistrées');

  -- ------------------------------------------------------------ Contraintes
  perform t.fails(format($q$insert into public.workout_sets (session_id, exercise_name, weight_kg, reps) values (%L, 'x', 501, 1)$q$, sess_id),
    'poids au-delà de 500 kg doit être refusé');
  perform t.fails(format($q$insert into public.workout_sets (session_id, exercise_name, weight_kg, reps) values (%L, 'x', 10, 0)$q$, sess_id),
    '0 répétition doit être refusé');
  perform t.fails(format($q$insert into public.workout_split_days (user_id, weekday, label) values (%L, 7, 'x')$q$, alice),
    'jour de semaine hors 0-6 doit être refusé');

  -- -------------------------------------------- Exercice supprimé : l'historique reste lisible
  delete from public.exercises where id = bench_id;
  select count(*) into n from public.workout_sets where exercise_name = 'Développé couché';
  perform t.assert(n = 2, 'la copie du nom résiste à la suppression de l''exercice');
  select exercise_id into bench_id from public.workout_sets limit 1;
  perform t.assert(bench_id is null, 'exercise_id passe à null (ON DELETE SET NULL)');

  -- -------------------------------------------------------------- Droits
  perform t.as_admin();
  perform t.as_user(bob);

  select count(*) into n from public.exercises; perform t.assert(n = 0, 'Bob ne voit pas les exercices d''Alice');
  select count(*) into n from public.workout_split_days; perform t.assert(n = 0, 'Bob ne voit pas le split d''Alice');
  select count(*) into n from public.workout_sessions; perform t.assert(n = 0, 'Bob ne voit pas les séances d''Alice');
  select count(*) into n from public.workout_sets; perform t.assert(n = 0, 'Bob ne voit pas les séries d''Alice');

  delete from public.workout_sessions where user_id = alice;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'Bob ne peut pas supprimer la séance d''Alice');

  -- ------------------------------------------------------------- Anonyme
  perform t.as_admin();
  perform t.as_anon();
  perform t.fails('select * from public.exercises', 'anon ne lit pas exercises');
  perform t.fails('select * from public.workout_sessions', 'anon ne lit pas workout_sessions');
  perform t.fails('select * from public.workout_sets', 'anon ne lit pas workout_sets');
  perform t.fails('select * from public.workout_split_days', 'anon ne lit pas workout_split_days');

  perform t.as_admin();
  raise notice 'workout_test : tous les tests passent';
end $$;
