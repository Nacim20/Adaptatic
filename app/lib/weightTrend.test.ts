import { describe, expect, it } from 'vitest';
import { trendSeries, WeightPoint } from './weightTrend';

function dateMinus(days: number): string {
  const d = new Date(Date.UTC(2026, 10, 14)); // 2026-11-14
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

describe('trendSeries', () => {
  it('lisse un pic isolé (même cas que WeightTrendTest.emaSmoothsOutASingleSpike côté Java)', () => {
    const entries: WeightPoint[] = [];
    for (let i = 10; i >= 1; i--) entries.push({ date: dateMinus(i), kg: 80 });
    entries.push({ date: dateMinus(0), kg: 82 }); // pic d'eau
    const trend = trendSeries(entries).at(-1)!.trend;
    expect(trend).toBeGreaterThan(80);
    expect(trend).toBeLessThan(80.8);
  });

  it('une seule pesée : la tendance vaut la pesée', () => {
    expect(trendSeries([{ date: '2026-11-14', kg: 75 }])).toEqual([{ date: '2026-11-14', kg: 75, trend: 75 }]);
  });

  it('liste vide : aucune tendance', () => {
    expect(trendSeries([])).toEqual([]);
  });

  it('remet les points dans l’ordre chronologique même si donnés en désordre', () => {
    const out = trendSeries([{ date: '2026-11-15', kg: 80 }, { date: '2026-11-14', kg: 79 }]);
    expect(out.map((p) => p.date)).toEqual(['2026-11-14', '2026-11-15']);
  });
});
