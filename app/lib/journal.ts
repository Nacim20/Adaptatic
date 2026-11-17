import { supabase } from './supabase';
import { scaleFood } from './nutrition';
import { Food, MealEntry, MealType, WaterLog } from './types';

/** Accès aux données du journal. Chaque fonction lève une Error avec un message lisible. */

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error || res.data === null) throw new Error(`${what} : ${res.error?.message ?? 'aucune donnée'}`);
  return res.data;
}

export async function fetchDay(uid: string, date: string): Promise<{ entries: MealEntry[]; water: WaterLog[] }> {
  const [e, w] = await Promise.all([
    supabase.from('meal_entries').select('*').eq('user_id', uid).eq('eaten_on', date).order('created_at'),
    supabase.from('water_logs').select('id,logged_on,amount_ml,created_at').eq('user_id', uid)
      .eq('logged_on', date).order('created_at'),
  ]);
  return { entries: check(e, 'Chargement du journal') as MealEntry[], water: check(w, "Chargement de l'eau") as WaterLog[] };
}

/** Dernières entrées (pour l'ajout rapide et les récents), la plus récente d'abord. */
export async function fetchRecentEntries(uid: string): Promise<MealEntry[]> {
  const res = await supabase.from('meal_entries').select('*').eq('user_id', uid)
    .order('created_at', { ascending: false }).limit(60);
  return check(res, 'Chargement des récents') as MealEntry[];
}

export async function addEntry(uid: string, p: { date: string; meal: MealType; food: Food; grams: number }) {
  // La base recalcule les valeurs (trigger) : on envoie les nôtres pour satisfaire les colonnes obligatoires.
  const n = scaleFood(p.food, p.grams);
  const res = await supabase.from('meal_entries').insert({
    user_id: uid, eaten_on: p.date, meal: p.meal, food_id: p.food.id, food_name: p.food.name,
    quantity_g: p.grams, ...n,
  });
  if (res.error) throw new Error(`Ajout impossible : ${res.error.message}`);
}

/** Ajout rapide : même aliment, même quantité qu'une entrée passée. */
export async function addEntryFromPast(uid: string, p: { date: string; meal: MealType; past: MealEntry }) {
  if (!p.past.food_id) throw new Error('Cet aliment a été supprimé');
  const res = await supabase.from('meal_entries').insert({
    user_id: uid, eaten_on: p.date, meal: p.meal, food_id: p.past.food_id, food_name: p.past.food_name,
    quantity_g: p.past.quantity_g, kcal: p.past.kcal, protein_g: p.past.protein_g,
    carbs_g: p.past.carbs_g, fat_g: p.past.fat_g,
  });
  if (res.error) throw new Error(`Ajout impossible : ${res.error.message}`);
}

export async function deleteEntry(id: string) {
  const res = await supabase.from('meal_entries').delete().eq('id', id);
  if (res.error) throw new Error(`Suppression impossible : ${res.error.message}`);
}

export async function addWater(uid: string, date: string, ml: number) {
  const res = await supabase.from('water_logs').insert({ user_id: uid, logged_on: date, amount_ml: ml });
  if (res.error) throw new Error(`Ajout d'eau impossible : ${res.error.message}`);
}

export async function deleteWater(id: string) {
  const res = await supabase.from('water_logs').delete().eq('id', id);
  if (res.error) throw new Error(`Suppression impossible : ${res.error.message}`);
}

export async function searchFoods(q: string): Promise<Food[]> {
  const res = await supabase.rpc('search_foods', { q, max_results: 30 });
  return check(res, 'Recherche') as Food[];
}

export type NewFood = Pick<Food, 'name' | 'brand' | 'kcal_100' | 'protein_100' | 'carbs_100' | 'fat_100' | 'serving_g' | 'serving_label'>;

export async function createFood(uid: string, f: NewFood): Promise<Food> {
  const res = await supabase.from('foods').insert({ ...f, owner_id: uid, source: 'user' }).select('*').single();
  return check(res, "Création de l'aliment") as Food;
}

export async function updateWaterTarget(uid: string, ml: number) {
  const res = await supabase.from('profiles').update({ water_target_ml: ml }).eq('user_id', uid);
  if (res.error) throw new Error(`Enregistrement impossible : ${res.error.message}`);
}

export async function fetchFoodsByIds(ids: string[]): Promise<Food[]> {
  if (ids.length === 0) return [];
  const res = await supabase.from('foods').select('*').in('id', ids);
  return check(res, 'Chargement des aliments') as Food[];
}

/** Aliment tout juste créé, à sélectionner au retour sur l'écran d'ajout (évite un aller-retour réseau). */
export const pendingSelection: { food: Food | null } = { food: null };
