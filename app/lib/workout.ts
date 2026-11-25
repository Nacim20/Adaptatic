import { supabase } from './supabase';
import { Exercise, SplitDay, WorkoutSession, WorkoutSet, WorkoutTemplate, WorkoutTemplateExercise } from './types';

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error || res.data === null) throw new Error(`${what} : ${res.error?.message ?? 'aucune donnée'}`);
  return res.data;
}

// ------------------------------------------------------------------- Split
export async function fetchSplit(uid: string): Promise<SplitDay[]> {
  const res = await supabase.from('workout_split_days').select('*').eq('user_id', uid);
  return check(res, 'Chargement du split') as SplitDay[];
}

export async function setSplitDay(uid: string, weekday: number, templateId: string | null) {
  const res = await supabase.from('workout_split_days')
    .upsert({ user_id: uid, weekday, template_id: templateId }, { onConflict: 'user_id,weekday' });
  if (res.error) throw new Error(`Enregistrement du split impossible : ${res.error.message}`);
}

// -------------------------------------------------------------- Exercices
export async function fetchAllExercises(uid: string): Promise<Exercise[]> {
  const res = await supabase.from('exercises').select('*').eq('owner_id', uid).order('name');
  return check(res, 'Chargement des exercices') as Exercise[];
}

export async function searchExercises(uid: string, q: string): Promise<Exercise[]> {
  const res = await supabase.from('exercises').select('*').eq('owner_id', uid).ilike('name', `%${q}%`).limit(20);
  return check(res, 'Recherche d\'exercices') as Exercise[];
}

/** Idempotent : un exercice "créé à la volée" plusieurs fois (modèle sans exercise_id, texte
 * libre ressaisi) doit renvoyer l'exercice existant plutôt que de violer l'unicité (owner_id, name).
 * Pas d'upsert : la table n'autorise que select/insert/delete (pas update) côté RLS. */
export async function createExercise(uid: string, name: string): Promise<Exercise> {
  const existing = await supabase.from('exercises').select('*').eq('owner_id', uid).eq('name', name).maybeSingle();
  if (existing.data) return existing.data as Exercise;

  const res = await supabase.from('exercises').insert({ owner_id: uid, name }).select('*').single();
  if (res.error?.code === '23505') {
    // Course avec une autre requête qui vient juste de créer le même exercice.
    const retry = await supabase.from('exercises').select('*').eq('owner_id', uid).eq('name', name).single();
    return check(retry, 'Création de l\'exercice') as Exercise;
  }
  return check(res, 'Création de l\'exercice') as Exercise;
}

/** Dernière série enregistrée pour cet exercice (toutes séances confondues), pour pré-remplir la saisie. */
export async function fetchLastSet(uid: string, exerciseId: string): Promise<WorkoutSet | null> {
  const res = await supabase.from('workout_sets')
    .select('*, workout_sessions!inner(user_id)')
    .eq('exercise_id', exerciseId).eq('workout_sessions.user_id', uid)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (res.error) throw new Error(`Chargement de la dernière série : ${res.error.message}`);
  return res.data as WorkoutSet | null;
}

// -------------------------------------------------------------- Modèles
export async function fetchTemplates(uid: string): Promise<WorkoutTemplate[]> {
  const res = await supabase.from('workout_templates').select('*').eq('owner_id', uid).order('name');
  return check(res, 'Chargement des modèles') as WorkoutTemplate[];
}

export async function fetchTemplateExercises(templateId: string): Promise<WorkoutTemplateExercise[]> {
  const res = await supabase.from('workout_template_exercises').select('*').eq('template_id', templateId).order('position');
  return check(res, 'Chargement des exercices du modèle') as WorkoutTemplateExercise[];
}

export interface NewTemplate {
  name: string;
  exercises: { exerciseId: string | null; name: string; targetSets: number | null; targetReps: number | null }[];
}

export async function createTemplate(uid: string, t: NewTemplate): Promise<WorkoutTemplate> {
  const template = check(
    await supabase.from('workout_templates').insert({ owner_id: uid, name: t.name }).select('*').single(),
    'Création du modèle',
  ) as WorkoutTemplate;

  const rows = t.exercises.map((e, i) => ({
    template_id: template.id, exercise_id: e.exerciseId, exercise_name: e.name, position: i + 1,
    target_sets: e.targetSets, target_reps: e.targetReps,
  }));
  const res = await supabase.from('workout_template_exercises').insert(rows);
  if (res.error) throw new Error(`Enregistrement des exercices du modèle : ${res.error.message}`);
  return template;
}

/** Exercice fait librement (hors modèle) qu'on décide d'ajouter à une séance pour la prochaine fois. */
export async function addExerciseToTemplate(
  templateId: string, exercise: { id: string; name: string },
  target?: { sets: number | null; reps: number | null },
) {
  const existing = check(
    await supabase.from('workout_template_exercises').select('position').eq('template_id', templateId),
    'Chargement du modèle',
  ) as { position: number }[];
  const position = existing.reduce((max, r) => Math.max(max, r.position), 0) + 1;
  const res = await supabase.from('workout_template_exercises').insert({
    template_id: templateId, exercise_id: exercise.id, exercise_name: exercise.name, position,
    target_sets: target?.sets ?? null, target_reps: target?.reps ?? null,
  });
  if (res.error) throw new Error(`Ajout au modèle impossible : ${res.error.message}`);
}

export async function updateTemplateExerciseTarget(id: string, targetSets: number | null, targetReps: number | null) {
  const res = await supabase.from('workout_template_exercises')
    .update({ target_sets: targetSets, target_reps: targetReps }).eq('id', id);
  if (res.error) throw new Error(`Mise à jour de l'objectif impossible : ${res.error.message}`);
}

/** Un créneau créé avec exercise_id = null (texte libre) se relie au vrai exercice dès sa création,
 * sinon il ne serait jamais reconnu comme "fait" ni pré-rempli les fois suivantes. */
export async function backfillTemplateExerciseId(templateId: string, exerciseName: string, exerciseId: string) {
  const res = await supabase.from('workout_template_exercises')
    .update({ exercise_id: exerciseId })
    .eq('template_id', templateId).eq('exercise_name', exerciseName).is('exercise_id', null);
  if (res.error) throw new Error(`Mise à jour du modèle impossible : ${res.error.message}`);
}

export async function deleteTemplate(id: string) {
  const res = await supabase.from('workout_templates').delete().eq('id', id);
  if (res.error) throw new Error(`Suppression impossible : ${res.error.message}`);
}

// -------------------------------------------------------------- Séances
/** Toutes les séries de l'utilisateur pour un exercice donné, des plus anciennes aux plus récentes. */
export async function fetchExerciseHistory(uid: string, exerciseId: string): Promise<{ performedOn: string; sets: WorkoutSet[] }[]> {
  const res = await supabase.from('workout_sets')
    .select('*, workout_sessions!inner(user_id, performed_on)')
    .eq('exercise_id', exerciseId).eq('workout_sessions.user_id', uid);
  const rows = check(res, "Chargement de l'historique") as (WorkoutSet & { workout_sessions: { performed_on: string } })[];
  const bySession: Record<string, { performedOn: string; sets: WorkoutSet[] }> = {};
  for (const r of rows) {
    const day = r.workout_sessions.performed_on;
    (bySession[day] ??= { performedOn: day, sets: [] }).sets.push(r);
  }
  return Object.values(bySession).sort((a, b) => a.performedOn.localeCompare(b.performedOn));
}

export async function fetchSetsForSession(sessionId: string): Promise<WorkoutSet[]> {
  const res = await supabase.from('workout_sets').select('*').eq('session_id', sessionId).order('set_order');
  return check(res, 'Chargement des séries') as WorkoutSet[];
}

export async function fetchTodaySession(uid: string, dateISO: string): Promise<WorkoutSession | null> {
  const res = await supabase.from('workout_sessions').select('*').eq('user_id', uid).eq('performed_on', dateISO).maybeSingle();
  if (res.error) throw new Error(`Chargement de la séance : ${res.error.message}`);
  return res.data as WorkoutSession | null;
}

export async function createSession(uid: string, dateISO: string, templateId: string | null, label: string | null): Promise<WorkoutSession> {
  const res = await supabase.from('workout_sessions')
    .insert({ user_id: uid, performed_on: dateISO, template_id: templateId, label }).select('*').single();
  return check(res, 'Création de la séance') as WorkoutSession;
}

export async function addSet(sessionId: string, exercise: { id: string | null; name: string }, weightKg: number, reps: number, order: number) {
  const res = await supabase.from('workout_sets').insert({
    session_id: sessionId, exercise_id: exercise.id, exercise_name: exercise.name,
    weight_kg: weightKg, reps, set_order: order,
  });
  if (res.error) throw new Error(`Ajout de la série impossible : ${res.error.message}`);
}

export async function deleteSet(id: string) {
  const res = await supabase.from('workout_sets').delete().eq('id', id);
  if (res.error) throw new Error(`Suppression impossible : ${res.error.message}`);
}
