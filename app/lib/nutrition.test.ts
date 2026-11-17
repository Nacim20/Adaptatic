import { describe, expect, it } from 'vitest';
import {
  dayLabel, defaultMealForHour, parseDecimal, ratio, recentDistinct, scaleFood, shiftDate, sumNutrients,
} from './nutrition';

const cream = { kcal_100: 200, protein_100: 2.5, carbs_100: 3, fat_100: 20 };

describe('scaleFood', () => {
  it('met à l’échelle pour 150 g (mêmes valeurs que le trigger SQL)', () => {
    expect(scaleFood(cream, 150)).toEqual({ kcal: 300, protein_g: 3.8, carbs_g: 4.5, fat_g: 30 });
  });
  it('100 g = valeurs de l’étiquette', () => {
    expect(scaleFood(cream, 100)).toEqual({ kcal: 200, protein_g: 2.5, carbs_g: 3, fat_g: 20 });
  });
  it('arrondit à 1 décimale', () => {
    expect(scaleFood({ kcal_100: 33, protein_100: 1, carbs_100: 1, fat_100: 1 }, 10).kcal).toBe(3.3);
  });
});

describe('sumNutrients', () => {
  it('somme sans erreur de virgule flottante visible', () => {
    const t = sumNutrients([
      { kcal: 0.1, protein_g: 0.1, carbs_g: 0.1, fat_g: 0.1 },
      { kcal: 0.2, protein_g: 0.2, carbs_g: 0.2, fat_g: 0.2 },
    ]);
    expect(t).toEqual({ kcal: 0.3, protein_g: 0.3, carbs_g: 0.3, fat_g: 0.3 });
  });
  it('liste vide = zéros', () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });
});

describe('ratio', () => {
  it('proportion normale', () => expect(ratio(50, 200)).toBe(0.25));
  it('plafonne à 1 au-delà de l’objectif (la barre ne déborde pas)', () => expect(ratio(300, 200)).toBe(1));
  it('objectif absent ou nul : 0, pas de division par zéro', () => {
    expect(ratio(10, 0)).toBe(0);
    expect(ratio(10, null)).toBe(0);
    expect(ratio(10, undefined)).toBe(0);
  });
  it('valeur négative ou nulle : 0', () => expect(ratio(-5, 100)).toBe(0));
});

describe('parseDecimal', () => {
  it('accepte la virgule française', () => expect(parseDecimal('12,5')).toBe(12.5));
  it('accepte le point et les espaces', () => expect(parseDecimal(' 7.25 ')).toBe(7.25));
  it('entier', () => expect(parseDecimal('250')).toBe(250));
  it('refuse vide, texte, négatif, double séparateur', () => {
    for (const bad of ['', '  ', 'abc', '-5', '1,2,3', '1e3', '12g']) expect(parseDecimal(bad)).toBeNull();
  });
});

describe('shiftDate / dayLabel', () => {
  it('traverse les fins de mois et d’année', () => {
    expect(shiftDate('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('libellés relatifs', () => {
    expect(dayLabel('2026-11-15', '2026-11-15')).toBe("Aujourd'hui");
    expect(dayLabel('2026-11-14', '2026-11-15')).toBe('Hier');
    expect(dayLabel('2026-11-16', '2026-11-15')).toBe('Demain');
  });
});

describe('defaultMealForHour', () => {
  it('suit les tranches horaires', () => {
    expect(defaultMealForHour(7)).toBe('breakfast');
    expect(defaultMealForHour(12)).toBe('lunch');
    expect(defaultMealForHour(16)).toBe('snack');
    expect(defaultMealForHour(20)).toBe('dinner');
    expect(defaultMealForHour(0)).toBe('breakfast');
  });
});

describe('recentDistinct', () => {
  it('garde la plus récente occurrence de chaque aliment et respecte la limite', () => {
    const e = [
      { food_id: 'a', q: 1 }, { food_id: 'b', q: 2 }, { food_id: 'a', q: 3 },
      { food_id: null, q: 4 }, { food_id: 'c', q: 5 },
    ];
    expect(recentDistinct(e, 10).map((x) => x.q)).toEqual([1, 2, 5]);
    expect(recentDistinct(e, 2).map((x) => x.q)).toEqual([1, 2]);
  });
});
