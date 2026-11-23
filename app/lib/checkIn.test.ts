import { describe, expect, it } from 'vitest';
import { checkInMessage } from './checkIn';
import { MealEntry, NutritionTargets } from './types';

function entry(kcal: number): MealEntry {
  return {
    id: '1', user_id: 'u', eaten_on: '2026-11-23', meal: 'lunch', food_id: null,
    food_name: 'x', quantity_g: 100, kcal, protein_g: 0, carbs_g: 0, fat_g: 0, created_at: '',
  };
}

function targets(calories_kcal: number): NutritionTargets {
  return {
    user_id: 'u', tdee_kcal: 2000, calories_kcal, protein_g: 100, carbs_g: 200, fat_g: 60,
    adaptive_offset_kcal: 0, event_offset_kcal: 0, weight_trend_kg: null, weekly_rate_kg: null,
    note: null, computed_at: '',
  };
}

describe('checkInMessage', () => {
  it("dit que l'objectif n'est pas encore calculé si targets est null", () => {
    expect(checkInMessage([], null)).toContain('pas encore calculé');
  });

  it("dit que rien n'est noté si le journal du jour est vide", () => {
    expect(checkInMessage([], targets(2000))).toContain('Rien noté');
  });

  it('signale un dépassement quand les kcal notées dépassent la cible', () => {
    const msg = checkInMessage([entry(2500)], targets(2000));
    expect(msg).toContain('2500');
    expect(msg).toContain('2000');
  });

  it('donne juste le ratio sans alarmer si on est dans la cible', () => {
    const msg = checkInMessage([entry(1200)], targets(2000));
    expect(msg).toContain('1200 / 2000');
  });
});
