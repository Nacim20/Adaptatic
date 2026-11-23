/**
 * Même formule que service/.../engine/WeightTrend.java (τ = 5 jours, voir docs/algorithm.md §1),
 * dupliquée ici pour que le graphique de progression marche sans dépendre du service Java.
 * Si la formule change côté moteur, celle-ci doit changer pareil.
 */
const TAU_DAYS = 5;

export interface WeightPoint {
  date: string; // AAAA-MM-JJ
  kg: number;
}

export interface TrendPoint extends WeightPoint {
  trend: number;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return ms / 86_400_000;
}

/** Tendance lissée pour chaque pesée (ordre chronologique), même lissage que le moteur. */
export function trendSeries(entries: WeightPoint[]): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];

  let value = sorted[0].kg;
  const out: TrendPoint[] = [{ ...sorted[0], trend: value }];
  for (let i = 1; i < sorted.length; i++) {
    const dt = Math.max(daysBetween(sorted[i - 1].date, sorted[i].date), 1);
    const alpha = 1 - Math.exp(-dt / TAU_DAYS);
    value += alpha * (sorted[i].kg - value);
    out.push({ ...sorted[i], trend: value });
  }
  return out;
}
