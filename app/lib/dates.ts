/** Date locale de l'appareil au format AAAA-MM-JJ (et non la date UTC de toISOString). */
export function localDateISO(d: Date = new Date()): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Fuseau IANA de l'appareil (ex. « Asia/Seoul »), « UTC » si indisponible. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** « SAMEDI 14 NOVEMBRE » : libellé de date des en-têtes. */
export function todayLabel(d: Date = new Date()): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
}
