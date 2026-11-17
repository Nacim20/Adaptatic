import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { cleanBarcode, isValidBarcode } from '../lib/barcode';
import { pendingSelection } from '../lib/journal';
import { lookupBarcode } from '../lib/service';
import { Button, Card, Field, Screen, Text, colors, styles } from '../lib/theme';
import { BackHeader } from '../lib/ui';

export default function Scan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false); // la caméra voit le même code des dizaines de fois par seconde

  async function search(code: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      pendingSelection.food = await lookupBarcode(code);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recherche impossible');
      setBusy(false);
      locked.current = false;
    }
  }

  function onScanned(data: string) {
    if (isValidBarcode(data)) search(data); // une lecture ratée (clé de contrôle fausse) est ignorée
  }

  function submitManual() {
    const code = cleanBarcode(manual);
    if (!isValidBarcode(code)) {
      return setError('Code invalide : vérifie les chiffres (8, 12, 13 ou 14 chiffres, clé de contrôle comprise).');
    }
    search(code);
  }

  const cameraAvailable = Platform.OS !== 'web';

  return (
    <Screen>
      <BackHeader title="Scanner un code-barres" />

      {cameraAvailable && permission?.granted && (
        <View style={{ height: 260, borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
            onBarcodeScanned={busy ? undefined : ({ data }) => onScanned(data)}
          />
        </View>
      )}
      {cameraAvailable && permission && !permission.granted && (
        <Card>
          <Text style={{ marginBottom: 8 }}>La caméra est nécessaire pour scanner un code-barres.</Text>
          {permission.canAskAgain
            ? <Button title="Autoriser la caméra" onPress={requestPermission} />
            : <Text style={{ color: colors.muted }}>Autorise la caméra dans les réglages du téléphone, ou saisis le code ci-dessous.</Text>}
        </Card>
      )}
      {!cameraAvailable && (
        <Text style={{ color: colors.muted, marginBottom: 12 }}>
          Le scan par caméra est disponible sur téléphone. Ici, saisis le code imprimé sous le code-barres.
        </Text>
      )}

      {busy && <Text style={{ color: colors.primary, marginBottom: 10 }}>Recherche du produit…</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <Card>
        <Field label="Ou saisis le code-barres" value={manual} onChangeText={setManual} keyboardType="numeric" />
        <Button title="Rechercher" onPress={submitManual} disabled={busy} />
      </Card>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Données produits : Open Food Facts (licence ODbL), base collaborative qui peut contenir des erreurs : vérifie les valeurs.
      </Text>
    </Screen>
  );
}
