/** Code-barres : validation et messages d'erreur du scan. Fonctions pures, testées (barcode.test.ts). */

/**
 * Vérifie la clé de contrôle GS1 (EAN-8, UPC-A, EAN-13, GTIN-14) : détecte une faute de frappe
 * ou une lecture ratée de la caméra avant d'interroger le service.
 */
export function isValidBarcode(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop() as number;
  let sum = 0;
  digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

/** Retire espaces et tirets saisis à la main ("3017 6204-22003"). */
export function cleanBarcode(input: string): string {
  return input.replace(/[\s-]/g, '');
}

const MESSAGES: Record<string, string> = {
  unauthorized: 'Session expirée : reconnecte-toi.',
  unavailable: "Le service n'est pas configuré pour le scan (clé publishable manquante).",
  invalid_barcode: 'Code-barres invalide.',
  rate_limited: 'Trop de recherches, réessaie dans une minute.',
  not_found: "Produit absent d'Open Food Facts. Tu peux créer l'aliment à la main.",
  incomplete: "Les données de ce produit sont inutilisables (valeurs manquantes ou incohérentes). Crée l'aliment à la main.",
  upstream: 'Open Food Facts ne répond pas, réessaie plus tard.',
};

/**
 * Message pour l'utilisateur. `errorCode` vient du corps JSON du service ; sans lui (réponse d'un
 * tunnel ou d'un proxy, panne réseau) on ne peut pas savoir ce qui a échoué : on le dit.
 */
export function describeBarcodeFailure(errorCode: string | null, status: number | null): string {
  if (errorCode && MESSAGES[errorCode]) return MESSAGES[errorCode];
  if (status === null) {
    return "Impossible de joindre ton service. Vérifie ta connexion et que le service (et son tunnel) est démarré.";
  }
  return `Le service ne répond pas comme prévu (HTTP ${status}). Vérifie qu'il est démarré.`;
}
