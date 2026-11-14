import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { createFood, pendingSelection } from '../lib/journal';
import { parseDecimal } from '../lib/nutrition';
import { useSession } from '../lib/session';
import { Button, Card, Field, Screen, Text, colors, styles } from '../lib/theme';
import { BackHeader } from '../lib/ui';

export default function CreateFood() {
  const router = useRouter();
  const { session } = useSession();
  const params = useLocalSearchParams<{ name?: string }>();
  const [name, setName] = useState(params.name ?? '');
  const [brand, setBrand] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [serving, setServing] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!session || busy) return;
    const k = parseDecimal(kcal);
    const p = parseDecimal(protein);
    const c = parseDecimal(carbs);
    const f = parseDecimal(fat);
    const s = serving.trim() === '' ? null : parseDecimal(serving);
    if (!name.trim()) return setError('Donne un nom à l\'aliment');
    if (k === null || k > 900) return setError('Calories pour 100 g : entre 0 et 900');
    if (p === null || c === null || f === null || p > 100 || c > 100 || f > 100) {
      return setError('Protéines, glucides et lipides pour 100 g : entre 0 et 100');
    }
    if (p + c + f > 101) return setError('Protéines + glucides + lipides ne peuvent pas dépasser 100 g pour 100 g');
    if (serving.trim() !== '' && (s === null || s <= 0 || s > 5000)) return setError('Portion entre 0,1 et 5000 g');

    setBusy(true);
    setError(null);
    try {
      const food = await createFood(session.user.id, {
        name: name.trim(), brand: brand.trim() || null,
        kcal_100: k, protein_100: p, carbs_100: c, fat_100: f,
        serving_g: s, serving_label: s && servingLabel.trim() ? servingLabel.trim() : null,
      });
      pendingSelection.food = food;
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackHeader title="Créer un aliment" />
      <Text style={{ color: colors.muted, marginBottom: 12 }}>
        Recopie les valeurs « pour 100 g » de l'étiquette. L'aliment reste privé, visible par toi seul.
      </Text>
      <Card>
        <Field label="Nom" value={name} onChangeText={setName} />
        <Field label="Marque (facultatif)" value={brand} onChangeText={setBrand} />
        <Field label="Calories (kcal pour 100 g)" value={kcal} onChangeText={setKcal} keyboardType="numeric" />
        <Field label="Protéines (g pour 100 g)" value={protein} onChangeText={setProtein} keyboardType="numeric" />
        <Field label="Glucides (g pour 100 g)" value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
        <Field label="Lipides (g pour 100 g)" value={fat} onChangeText={setFat} keyboardType="numeric" />
        <Field label="Portion habituelle en g (facultatif)" value={serving} onChangeText={setServing} keyboardType="numeric" />
        {serving.trim() !== '' && (
          <Field label="Nom de la portion (ex. 1 tranche)" value={servingLabel} onChangeText={setServingLabel} />
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="Enregistrer" onPress={save} disabled={busy} />
      </Card>
    </Screen>
  );
}
