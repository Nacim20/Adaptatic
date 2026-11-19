import { describeBarcodeFailure } from './barcode';
import { supabase } from './supabase';
import { Food, ForecastDay } from './types';

/** Appels à ton service Java (tunnel). Le jeton de la session prouve qui appelle. */
const base = (process.env.EXPO_PUBLIC_SERVICE_URL ?? '').replace(/\/+$/, '');

export const serviceConfigured = base !== '';

/** Aliment pour un code-barres (catalogue partagé, sinon Open Food Facts). Lève une Error lisible. */
export async function lookupBarcode(code: string): Promise<Food> {
  if (!serviceConfigured) {
    throw new Error("Scan non configuré : ajoute EXPO_PUBLIC_SERVICE_URL (URL de ton tunnel) dans app/.env, puis relance l'app.");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Session expirée : reconnecte-toi.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${base}/api/foods/barcode/${code}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } catch {
    throw new Error(describeBarcodeFailure(null, null));
  } finally {
    clearTimeout(timer);
  }

  let body: { food?: Food; error?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null; // page d'erreur du tunnel, etc.
  }
  if (!res.ok || !body?.food) throw new Error(describeBarcodeFailure(body?.error ?? null, res.status));
  return body.food;
}

/** Plan des prochains jours ("Programme"), calculé par le service. Lève une Error lisible. */
export async function fetchForecast(days = 7): Promise<ForecastDay[]> {
  if (!serviceConfigured) {
    throw new Error("Programme non configuré : ajoute EXPO_PUBLIC_SERVICE_URL (URL de ton tunnel) dans app/.env, puis relance l'app.");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Session expirée : reconnecte-toi.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${base}/api/targets/forecast?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } catch {
    throw new Error('Impossible de joindre ton service. Vérifie ton tunnel et relance.');
  } finally {
    clearTimeout(timer);
  }

  let body: { days?: ForecastDay[]; error?: string; message?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || !body?.days) {
    throw new Error(body?.message ?? `Calcul du programme impossible (HTTP ${res.status}).`);
  }
  return body.days;
}
