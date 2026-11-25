-- Tests des modèles de séance (workout_templates) : composition, split, RLS.
-- Suppose que food_journal_test.sql et workout_test.sql ont déjà tourné (alice/bob,
-- catalogue d'exercices d'Alice) : voir tests/run.sh.

do $$
declare
  alice uuid := '00000000-0000-0000-0000-00000000000a';
  bob   uuid := '00000000-0000-0000-0000-00000000000b';
  squat_id uuid;
  tmpl_id uuid;
  sess_id uuid;
  n int;
begin
  perform t.as_user(alice);

  insert into public.exercises (owner_id, name) values (alice, 'Squat') returning id into squat_id;
  insert into public.workout_templates (owner_id, name) values (alice, 'Legs Day') returning id into tmpl_id;
  insert into public.workout_template_exercises (template_id, exercise_id, exercise_name, position)
    values (tmpl_id, squat_id, 'Squat', 1),
           (tmpl_id, null, 'Fentes', 2);

  select count(*) into n from public.workout_template_exercises where template_id = tmpl_id;
  perform t.assert(n = 2, 'les deux exercices du modèle sont enregistrés');

  -- Le split peut pointer vers ce modèle.
  insert into public.workout_split_days (user_id, weekday, template_id) values (alice, 2, tmpl_id);
  select count(*) into n from public.workout_split_days where user_id = alice and template_id = tmpl_id;
  perform t.assert(n = 1, 'le split référence bien le modèle');

  -- Une séance peut aussi s'y référer (jour différent pour ne pas entrer en conflit avec
  -- la séance du jour déjà créée par workout_test.sql).
  insert into public.workout_sessions (user_id, performed_on, template_id)
    values (alice, current_date - 1, tmpl_id) returning id into sess_id;
  select count(*) into n from public.workout_sessions where id = sess_id and template_id = tmpl_id;
  perform t.assert(n = 1, 'la séance référence bien le modèle');

  -- -------------------------------------------- Modèle supprimé : les séances ne cassent pas
  delete from public.workout_templates where id = tmpl_id;
  select count(*) into n from public.workout_sessions where id = sess_id and template_id is null;
  perform t.assert(n = 1, 'la séance existe toujours après suppression du modèle (template_id -> null)');
  select count(*) into n from public.workout_split_days where user_id = alice and weekday = 2 and template_id is null;
  perform t.assert(n = 1, 'le split repasse à "aucun modèle" après suppression');

  -- -------------------------------------------------------------- Droits
  perform t.as_admin();
  perform t.as_user(alice);
  insert into public.workout_templates (owner_id, name) values (alice, 'Push Day') returning id into tmpl_id;

  perform t.as_admin();
  perform t.as_user(bob);
  select count(*) into n from public.workout_templates; perform t.assert(n = 0, 'Bob ne voit pas les modèles d''Alice');
  perform t.fails(format($q$insert into public.workout_template_exercises (template_id, exercise_name, position) values (%L, 'x', 1)$q$, tmpl_id),
    'Bob ne peut pas ajouter un exercice au modèle d''Alice');
  delete from public.workout_templates where owner_id = alice;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'Bob ne peut pas supprimer le modèle d''Alice');

  -- ------------------------------------------------------------- Anonyme
  perform t.as_admin();
  perform t.as_anon();
  perform t.fails('select * from public.workout_templates', 'anon ne lit pas workout_templates');
  perform t.fails('select * from public.workout_template_exercises', 'anon ne lit pas workout_template_exercises');

  perform t.as_admin();
  raise notice 'workout_templates_test : tous les tests passent';
end $$;
