import { supabase } from './supabase';
import { localDateISO } from './dates';
import { CalorieEvent } from './types';

/** Un imprévu reste "actif" tant qu'il peut encore influencer un jour (même fenêtre que le moteur). */
const EVENT_MAX_SPREAD_DAYS = 10;

/** Imprévu encore actif pour cet utilisateur, s'il y en a un (un seul à la fois). */
export async function fetchActiveEvent(uid: string): Promise<CalorieEvent | null> {
  const since = new Date();
  since.setDate(since.getDate() - EVENT_MAX_SPREAD_DAYS);
  const res = await supabase.from('calorie_events').select('*').eq('user_id', uid)
    .gte('event_date', since.toISOString().slice(0, 10))
    .order('event_date', { ascending: false }).limit(1).maybeSingle();
  if (res.error) throw new Error(`Chargement de l'imprévu : ${res.error.message}`);
  return res.data as CalorieEvent | null;
}

/** Déclare un imprévu pour aujourd'hui. Échoue si un imprévu est déjà actif (trigger en base). */
export async function declareEvent(uid: string, excessKcal: number) {
  const res = await supabase.from('calorie_events').insert({
    user_id: uid, event_date: localDateISO(), excess_kcal: excessKcal,
  });
  if (res.error) throw new Error(`Imprévu impossible à enregistrer : ${res.error.message}`);
}

export async function cancelEvent(id: string) {
  const res = await supabase.from('calorie_events').delete().eq('id', id);
  if (res.error) throw new Error(`Annulation impossible : ${res.error.message}`);
}
