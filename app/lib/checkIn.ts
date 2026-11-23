import { sumNutrients } from './nutrition';
import { MealEntry, NutritionTargets } from './types';

/** Message du rappel "ton programme du jour", selon ce qui est noté par rapport à la cible. */
export function checkInMessage(entries: MealEntry[], targets: NutritionTargets | null): string {
  if (!targets) return "Ton objectif du jour n'est pas encore calculé.";
  const kcal = Math.round(sumNutrients(entries).kcal);
  if (entries.length === 0) return `Rien noté aujourd'hui pour l'instant. Objectif : ${targets.calories_kcal} kcal.`;
  if (kcal > targets.calories_kcal) return `Tu as déjà noté ${kcal} kcal sur ${targets.calories_kcal} visés.`;
  return `${kcal} / ${targets.calories_kcal} kcal notés pour l'instant.`;
}
