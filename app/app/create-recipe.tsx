import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { createRecipe, pendingSelection, searchFoods } from '../lib/journal';
import { parseDecimal } from '../lib/nutrition';
import { useSession } from '../lib/session';
import { Button, Card, Field, Screen, Text, colors, styles } from '../lib/theme';
import { Food } from '../lib/types';
import { BackHeader } from '../lib/ui';

interface Ingredient { food: Food; grams: number }

export default function CreateRecipe() {
  const router = useRouter();
  const { session } = useSession();

  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [picking, setPicking] = useState<Food | null>(null);
  const [pickGrams, setPickGrams] = useState('');
  const searchId = useRef(0);

  const [yieldG, setYieldG] = useState('');
  const [yieldTouched, setYieldTouched] = useState(false);
  const [portions, setPortions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const id = ++searchId.current;
    const timer = setTimeout(() => {
      searchFoods(q).then((r) => { if (id === searchId.current) setResults(r); }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const sumGrams = ingredients.reduce((s, i) => s + i.grams, 0);
  useEffect(() => {
    if (!yieldTouched) setYieldG(sumGrams > 0 ? String(sumGrams) : '');
  }, [sumGrams, yieldTouched]);

  function addIngredient() {
    const g = parseDecimal(pickGrams);
    if (!picking || g === null || g <= 0) return setError('Quantité invalide pour cet ingrédient');
    setIngredients((prev) => [...prev, { food: picking, grams: g }]);
    setPicking(null);
    setPickGrams('');
    setQuery('');
    setResults([]);
    setError(null);
  }

  function removeIngredient(i: number) {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  }

  const yieldNum = parseDecimal(yieldG);
  const portionsNum = portions.trim() === '' ? null : Math.round(Number(portions));

  const preview = yieldNum && yieldNum > 0 && ingredients.length > 0 ? {
    kcal: ingredients.reduce((s, i) => s + i.food.kcal_100 * i.grams / 100, 0) / yieldNum * 100,
  } : null;

  async function save() {
    if (!session || busy) return;
    if (!name.trim()) return setError('Donne un nom à la recette');
    if (ingredients.length === 0) return setError('Ajoute au moins un ingrédient');
    if (yieldNum === null || yieldNum <= 0) return setError('Indique le poids du plat fini (pèse-le une fois cuit)');
    if (portions.trim() !== '' && (!portionsNum || portionsNum < 1)) return setError('Nombre de portions invalide');

    setBusy(true);
    setError(null);
    try {
      const food = await createRecipe({
        name: name.trim(),
        ingredients: ingredients.map((i) => ({ food_id: i.food.id, grams: i.grams })),
        yieldG: yieldNum,
        portions: portionsNum,
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
      <BackHeader title="Créer une recette" />
      <Text style={{ color: colors.muted, marginBottom: 12 }}>
        Ajoute les ingrédients et leurs quantités, puis pèse le plat une fois prêt : les valeurs
        nutritionnelles sont calculées à partir de ça, pas inventées.
      </Text>

      <Card>
        <Field label="Nom de la recette" value={name} onChangeText={setName} />

        {ingredients.map((ing, i) => (
          <View key={i} style={[styles.row, { alignItems: 'center', paddingVertical: 6 }]}>
            <Text style={{ flex: 1 }}>{ing.food.name}</Text>
            <Text style={{ color: colors.muted, marginRight: 10 }}>{ing.grams} g</Text>
            <Pressable accessibilityLabel={`Retirer ${ing.food.name}`} onPress={() => removeIngredient(i)}>
              <Text style={{ color: colors.muted }}>✕</Text>
            </Pressable>
          </View>
        ))}

        {picking ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: '600', marginBottom: 6 }}>{picking.name}</Text>
            <Field label="Quantité (g)" value={pickGrams} onChangeText={setPickGrams} keyboardType="numeric" />
            <Button title="Ajouter l'ingrédient" onPress={addIngredient} disabled={!pickGrams} />
            <Button secondary title="Annuler" onPress={() => setPicking(null)} />
          </View>
        ) : (
          <View style={{ marginTop: ingredients.length > 0 ? 10 : 0 }}>
            <Field label="Rechercher un ingrédient (2 lettres minimum)" value={query} onChangeText={setQuery} autoCapitalize="none" />
            {results.map((f) => (
              <Pressable key={f.id} onPress={() => setPicking(f)}
                style={{ backgroundColor: colors.cardAlt, borderRadius: 12, padding: 10, marginBottom: 6 }}>
                <Text>{f.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{f.kcal_100} kcal / 100 g</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      {ingredients.length > 0 && (
        <Card>
          <Field label="Poids du plat fini, une fois cuit (g)" value={yieldG}
            onChangeText={(v) => { setYieldG(v); setYieldTouched(true); }} keyboardType="numeric" />
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: -6, marginBottom: 10 }}>
            Pré-rempli avec la somme des ingrédients ({sumGrams} g) ; corrige avec le poids réel pesé
            si l'eau s'est évaporée ou absorbée à la cuisson.
          </Text>
          <Field label="Nombre de portions (facultatif)" value={portions} onChangeText={setPortions} keyboardType="numeric" />

          {preview && (
            <Text style={{ marginTop: 4 }}>
              <Text style={{ fontWeight: '700' }}>≈ {Math.round(preview.kcal)} kcal / 100 g</Text>
              <Text style={{ color: colors.muted }}>  (estimation, le calcul définitif vient du serveur)</Text>
            </Text>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          <Button title="Créer la recette" onPress={save} disabled={busy} />
        </Card>
      )}
      {ingredients.length === 0 && error && <Text style={styles.error}>{error}</Text>}
    </Screen>
  );
}
