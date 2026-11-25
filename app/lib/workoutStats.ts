/**
 * Jour de la semaine (0 = dimanche … 6 = samedi) d'une date AAAA-MM-JJ, sans dépendre du fuseau.
 */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface SetLike {
  weight_kg: number;
  reps: number;
}

/**
 * Plus lourde série d'un ensemble (le signal le plus direct de progression sur un exercice :
 * pas de volume ni de 1RM estimé, juste "le plus lourd soulevé ce jour-là").
 */
export function topSetWeight(sets: SetLike[]): number | null {
  if (sets.length === 0) return null;
  return Math.max(...sets.map((s) => s.weight_kg));
}
