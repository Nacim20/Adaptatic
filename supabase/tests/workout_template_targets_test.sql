-- Tests de l'objectif séries/répétitions et de la permission de mise à jour sur
-- workout_template_exercises. Suppose food_journal_test.sql et workout_test.sql déjà joués.

do $$
declare
  alice uuid := '00000000-0000-0000-0000-00000000000a';
  bob   uuid := '00000000-0000-0000-0000-00000000000b';
  tmpl_id uuid;
  te_id uuid;
  n int;
begin
  perform t.as_user(alice);

  insert into public.workout_templates (owner_id, name) values (alice, 'Push Day') returning id into tmpl_id;
  insert into public.workout_template_exercises (template_id, exercise_name, position, target_sets, target_reps)
    values (tmpl_id, 'Développé couché', 1, 4, 10) returning id into te_id;

  select target_sets into n from public.workout_template_exercises where id = te_id;
  perform t.assert(n = 4, 'objectif séries enregistré');

  -- Édition par le propriétaire (nécessite la permission update, absente avant cette migration).
  update public.workout_template_exercises set target_sets = 5, target_reps = 8 where id = te_id;
  select target_sets into n from public.workout_template_exercises where id = te_id;
  perform t.assert(n = 5, 'le propriétaire peut modifier l''objectif');

  perform t.fails(format($q$update public.workout_template_exercises set target_sets = 99 where id = %L$q$, te_id),
    'objectif séries hors 1-20 doit être refusé');
  perform t.fails(format($q$update public.workout_template_exercises set target_reps = 0 where id = %L$q$, te_id),
    'objectif répétitions hors 1-100 doit être refusé');

  -- -------------------------------------------------------------- Droits
  -- RLS sur update ne lève pas d'exception : la ligne n'est juste pas visible, 0 ligne affectée.
  perform t.as_admin();
  perform t.as_user(bob);
  update public.workout_template_exercises set target_sets = 1 where id = te_id;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'Bob ne peut pas modifier le créneau d''Alice');

  perform t.as_admin();
  raise notice 'workout_template_targets_test : tous les tests passent';
end $$;
