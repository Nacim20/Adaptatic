/** Calculs du journal alimentaire. Fonctions pures, testées (nutrition.test.ts). */

export interface Nutrients {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Valeurs pour 100 g d'un aliment. */
export interface Per100g {
  kcal_100: number;
  protein_100: number;
  carbs_100: number;
  fat_100: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Nutriments pour une quantité en grammes (même arrondi que la base : 1 décimale). */
export function scaleFood(food: Per100g, grams: number): Nutrients {
  const k = grams / 100;
  return {
    kcal: round1(food.kcal_100 * k),
    protein_g: round1(food.protein_100 * k),
    carbs_g: round1(food.carbs_100 * k),
    fat_g: round1(food.fat_100 * k),
  };
}

export function sumNutrients(items: Nutrients[]): Nutrients {
  const total = items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      protein_g: acc.protein_g + i.protein_g,
      carbs_g: acc.carbs_g + i.carbs_g,
      fat_g: acc.fat_g + i.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
  return {
    kcal: round1(total.kcal),
    protein_g: round1(total.protein_g),
    carbs_g: round1(total.carbs_g),
    fat_g: round1(total.fat_g),
  };
}

/** Part de l'objectif atteinte, bornée à [0, 1] pour une barre de progression. Objectif absent : 0. */
export function ratio(value: number, target: number | null | undefined): number {
  if (!target || target <= 0 || value <= 0) return 0;
  return Math.min(value / target, 1);
}

/** Nombre saisi par l'utilisateur ("12,5" ou "12.5"). null si vide ou invalide. */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (s === '' || !/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Décale une date AAAA-MM-JJ de n jours, sans dépendre du fuseau (calcul en UTC). */
export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** « Aujourd'hui », « Hier », « Demain » ou « sam. 14 nov. ». */
export function dayLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return "Aujourd'hui";
  if (iso === shiftDate(todayIso, -1)) return 'Hier';
  if (iso === shiftDate(todayIso, 1)) return 'Demain';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * Repas proposé par défaut selon l'heure locale (heuristique d'ergonomie, pas un fait
 * nutritionnel) : sert à l'ajout rapide, l'utilisateur peut toujours choisir.
 */
export function defaultMealForHour(hour: number): MealType {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}

/** Aliments récents distincts (le plus récent d'abord), avec la dernière quantité utilisée. */
export function recentDistinct<T extends { food_id: string | null }>(entries: T[], limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of entries) {
    if (!e.food_id || seen.has(e.food_id)) continue;
    seen.add(e.food_id);
    out.push(e);
    if (out.length === limit) break;
  }
  return out;
}
