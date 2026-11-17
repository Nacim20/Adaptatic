import { describe, expect, it } from 'vitest';
import { cleanBarcode, describeBarcodeFailure, isValidBarcode } from './barcode';

describe('isValidBarcode', () => {
  it('accepte des codes valides de chaque longueur', () => {
    expect(isValidBarcode('4006381333931')).toBe(true); // EAN-13
    expect(isValidBarcode('3017620422003')).toBe(true); // EAN-13
    expect(isValidBarcode('96385074')).toBe(true); // EAN-8
    expect(isValidBarcode('036000291452')).toBe(true); // UPC-A
    expect(isValidBarcode('10012345678902')).toBe(true); // GTIN-14
  });
  it('refuse une clé de contrôle fausse (faute de frappe ou lecture ratée)', () => {
    expect(isValidBarcode('4006381333932')).toBe(false);
    expect(isValidBarcode('3017620422004')).toBe(false);
    expect(isValidBarcode('96385075')).toBe(false);
  });
  it('refuse les mauvaises longueurs et les non-chiffres', () => {
    for (const bad of ['', '123', '123456789', '12345678901', '123456789012345', 'abcdefgh', '30176204220o3', '3017 620422003']) {
      expect(isValidBarcode(bad)).toBe(false);
    }
  });
  it('un chiffre modifié est toujours détecté (substitution d’un seul chiffre)', () => {
    const base = '3017620422003';
    for (let i = 0; i < base.length; i++) {
      for (const d of '0123456789') {
        if (d === base[i]) continue;
        expect(isValidBarcode(base.slice(0, i) + d + base.slice(i + 1))).toBe(false);
      }
    }
  });
});

describe('cleanBarcode', () => {
  it('retire espaces et tirets', () => {
    expect(cleanBarcode(' 3017 6204-22003 ')).toBe('3017620422003');
  });
});

describe('describeBarcodeFailure', () => {
  it('utilise le code d’erreur du service', () => {
    expect(describeBarcodeFailure('not_found', 404)).toContain('absent');
    expect(describeBarcodeFailure('rate_limited', 429)).toContain('minute');
    expect(describeBarcodeFailure('incomplete', 422)).toContain('à la main');
    expect(describeBarcodeFailure('unauthorized', 401)).toContain('reconnecte');
  });
  it('panne réseau : le dit sans accuser Open Food Facts', () => {
    const m = describeBarcodeFailure(null, null);
    expect(m).toContain('joindre ton service');
    expect(m).not.toContain('Open Food Facts');
  });
  it('réponse inattendue (ex. page d’erreur du tunnel) : donne le statut HTTP', () => {
    expect(describeBarcodeFailure(null, 530)).toContain('HTTP 530');
    expect(describeBarcodeFailure('code_inconnu', 502)).toContain('HTTP 502');
  });
});
