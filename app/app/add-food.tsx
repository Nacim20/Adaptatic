import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { addEntry, fetchFoodsByIds, fetchRecentEntries, pendingSelection, searchFoods } from '../lib/journal';
import { parseDecimal, recentDistinct, scaleFood } from '../lib/nutrition';
import { useSession } from '../lib/session';
import { Button, Card, Field, Screen, Text, colors, styles } from '../lib/theme';
import { Food, MEALS, MEAL_LABELS, MealType } from '../lib/types';
import { BackHeader, Chip } from '../lib/ui';

const MIN_G = 0.1;
const MAX_G = 10000;

export default function AddFood() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const [meal, setMeal] = useState<MealType>(MEALS.includes(params.meal as MealType) ? (params.meal as MealType) : 'lunch');
  const date = params.date ?? '';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [recents, setRecents] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const searchId = useRef(0);

  const select = useCallback((f: Food) => {
    setSelected(f);
    setGrams(String(f.serving_g ?? 100));
    setError(null);
  }, []);

  // Aliments récents (affichés tant qu'on ne cherche pas).
  useEffect(() => {
    if (!uid) return;
    fetchRecentEntries(uid)
      .then((entries) => fetchFoodsByIds(recentDistinct(entries, 10).map((e) => e.food_id as string)))
      .then(setRecents)
      .catch(() => { /* les récents sont un confort : on n'affiche pas d'erreur */ });
  }, [uid]);

  // Retour de la création d'un aliment : on le sélectionne directement.
  useFocusEffect(useCallback(() => {
    if (pendingSelection.food) {
      select(pendingSelection.food);
      pendingSelection.food = null;
    }
  }, [select]));

  // Recherche avec délai (évite une requête par lettre) ; on ignore les réponses périmées.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const id = ++searchId.current;
    const timer = setTimeout(() => {
      searchFoods(q)
        .then((r) => { if (id === searchId.current) { setResults(r); setError(null); } })
        .catch((e) => { if (id === searchId.current) setError(e instanceof Error ? e.message : 'Recherche impossible'); });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const g = parseDecimal(grams);
  const gramsOk = g !== null && g >= MIN_G && g <= MAX_G;
  const preview = selected && gramsOk ? scaleFood(selected, g) : null;

  async function add() {
    if (!uid || !selected || !gramsOk || busy) return;
    setBusy(true);
    try {
      await addEntry(uid, { date, meal, food: selected, grams: g });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ajout impossible');
      setBusy(false);
    }
  }

  const list = query.trim().length >= 2 ? results : recents;

  return (
    <Screen>
      <BackHeader title="Ajouter un aliment" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {MEALS.map((m) => <Chip key={m} label={MEAL_LABELS[m]} selected={m === meal} onPress={() => setMeal(m)} />)}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}

      {selected ? (
        <Card>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>{selected.name}</Text>
          {selected.brand && <Text style={{ color: colors.muted }}>{selected.brand}</Text>}
          <Text style={{ color: colors.muted, fontSize: 12, marginVertical: 6 }}>
            Pour 100 g : {selected.kcal_100} kcal · P {selected.protein_100} · G {selected.carbs_100} · L {selected.fat_100}
          </Text>
          <Field label="Quantité (g)" value={grams} onChangeText={setGrams} keyboardType="numeric" />
          {selected.serving_g && (
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Chip label={`${selected.serving_label ?? '1 portion'} (${selected.serving_g} g)`}
                selected={g === selected.serving_g} onPress={() => setGrams(String(selected.serving_g))} />
            </View>
          )}
          {!gramsOk && <Text style={styles.error}>Quantité entre {MIN_G} et {MAX_G} g</Text>}
          {preview && (
            <Text style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '700', fontSize: 18 }}>{Math.round(preview.kcal)} kcal</Text>
              <Text style={{ color: colors.muted }}>  ·  P {preview.protein_g} · G {preview.carbs_g} · L {preview.fat_g}</Text>
            </Text>
          )}
          <Button title={`Ajouter au ${MEAL_LABELS[meal]}`} onPress={add} disabled={busy || !gramsOk} />
          <Button secondary title="Choisir un autre aliment" onPress={() => setSelected(null)} />
        </Card>
      ) : (
        <>
          <Field label="Rechercher (2 lettres minimum)" value={query} onChangeText={setQuery} autoCapitalize="none" />
          {query.trim().length < 2 && list.length > 0 && <Text style={{ color: colors.muted, marginBottom: 6 }}>Récents</Text>}
          {query.trim().length >= 2 && results.length === 0 && !error && (
            <Text style={{ color: colors.muted, marginBottom: 8 }}>Aucun aliment trouvé. Tu peux le créer ci-dessous.</Text>
          )}
          {list.map((f) => (
            <Pressable key={f.id} onPress={() => select(f)}
              style={{ backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontWeight: '600' }}>{f.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {f.brand ? `${f.brand} · ` : ''}{f.kcal_100} kcal / 100 g
              </Text>
            </Pressable>
          ))}
          <Button secondary title="Créer un aliment" onPress={() => router.push({ pathname: '/create-food', params: { name: query.trim() } })} />
        </>
      )}
    </Screen>
  );
}
