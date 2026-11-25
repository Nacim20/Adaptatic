import { describe, expect, it } from 'vitest';
import { topSetWeight, weekdayOf } from './workoutStats';

describe('weekdayOf', () => {
  it('reconnaît un dimanche et un samedi', () => {
    expect(weekdayOf('2026-11-22')).toBe(0); // dimanche
    expect(weekdayOf('2026-11-28')).toBe(6); // samedi
  });
  it('jour de semaine normal', () => expect(weekdayOf('2026-11-23')).toBe(1)); // lundi
});

describe('topSetWeight', () => {
  it('prend la plus lourde série', () => {
    expect(topSetWeight([{ weight_kg: 60, reps: 8 }, { weight_kg: 80, reps: 3 }, { weight_kg: 70, reps: 5 }])).toBe(80);
  });
  it('une seule série', () => expect(topSetWeight([{ weight_kg: 60, reps: 8 }])).toBe(60));
  it('liste vide = null', () => expect(topSetWeight([])).toBeNull());
});
