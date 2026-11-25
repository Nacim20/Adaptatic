-- Objectif séries/répétitions par exercice de modèle : entré par l'utilisateur lui-même
-- (jamais suggéré par l'app), affiché comme rappel chaque jour où la séance revient.
alter table public.workout_template_exercises
  add column target_sets smallint check (target_sets between 1 and 20),
  add column target_reps smallint check (target_reps between 1 and 100);

-- Permission manquante depuis la migration précédente : relier automatiquement un créneau
-- "texte libre" au vrai exercice une fois créé (voir app/lib/workout.ts backfillTemplateExerciseId)
-- nécessite de modifier la ligne, pas seulement de la lire/créer/supprimer. Aussi nécessaire pour
-- éditer un objectif sets/reps après coup, ou pour ajouter un exercice existant à un modèle.
create policy "workout_template_exercises: mise à jour" on public.workout_template_exercises for update
  using (exists (select 1 from public.workout_templates t where t.id = template_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.workout_templates t where t.id = template_id and t.owner_id = auth.uid()));

grant update on public.workout_template_exercises to authenticated;
