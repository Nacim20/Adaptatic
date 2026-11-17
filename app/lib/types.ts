export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'cut' | 'maintain' | 'bulk';

export interface Profile {
  user_id: string;
  sex: Sex;
  birth_date: string;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: Goal;
  weekly_rate_pct: number;
  timezone: string;
  water_target_ml: number;
}

export interface WeightLog {
  id: number;
  weight_kg: number;
  logged_on: string;
}

export interface NutritionTargets {
  user_id: string;
  tdee_kcal: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  adaptive_offset_kcal: number;
  weight_trend_kg: number | null;
  weekly_rate_kg: number | null;
  note: string | null;
  computed_at: string;
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sédentaire (bureau, peu de sport)',
  light: 'Légèrement actif (1-3 séances/sem.)',
  moderate: 'Modérément actif (3-5 séances/sem.)',
  active: 'Très actif (6-7 séances/sem.)',
  very_active: 'Extrêmement actif (travail physique + sport)',
};

export const GOAL_LABELS: Record<Goal, string> = {
  cut: 'Perdre du poids',
  maintain: 'Maintenir',
  bulk: 'Prendre du muscle',
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
};

/** Aliment, valeurs pour 100 g. owner_id null = catalogue partagé. */
export interface Food {
  id: string;
  owner_id: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal_100: number;
  protein_100: number;
  carbs_100: number;
  fat_100: number;
  serving_g: number | null;
  serving_label: string | null;
  source: 'user' | 'openfoodfacts' | 'ciqual';
}

/** Entrée de repas : copie nutritionnelle calculée par la base. */
export interface MealEntry {
  id: string;
  user_id: string;
  eaten_on: string;
  meal: MealType;
  food_id: string | null;
  food_name: string;
  quantity_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
}

export interface WaterLog {
  id: string;
  logged_on: string;
  amount_ml: number;
  created_at: string;
}
