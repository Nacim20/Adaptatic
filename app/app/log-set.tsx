import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { parseDecimal } from '../lib/nutrition';
import { useSession } from '../lib/session';
import { Button, Card, Field, Screen, Text, colors, styles } from '../lib/theme';
import { Exercise } from '../lib/types';
import { BackHeader } from '../lib/ui';
import { addSet, createExercise, createSession, fetchLastSet, fetchTodaySession, searchExercises } from '../lib/workout';

export default function LogSet() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const params = useLocalSearchParams<{
    date: string; templateId?: string; nextOrder?: string; exerciseId?: string; exerciseName?: string;
  }>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);
  const [picked, setPicked] = useState<{ id: string | null; name: string } | null>(
    params.exerciseName ? { id: params.exerciseId ?? null, name: params.exerciseName } : null,
  );
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const searchId = useRef(0);

  // Exercice déjà choisi (créneau d'un modèle) : propose les valeurs de la dernière fois.
  useEffect(() => {
    if (!uid || !params.exerciseId) return;
    fetchLastSet(uid, params.exerciseId).then((last) => {
      if (last) { setWeight(String(last.weight_kg)); setReps(String(last.reps)); }
    }).catch(() => {});
  }, [uid, params.exerciseId]);

  useEffect(() => {
    if (!uid || picked) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const id = ++searchId.current;
    const timer = setTimeout(() => {
      searchExercises(uid, q).then((r) => { if (id === searchId.current) setResults(r); }).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [query, uid, picked]);

  async function save() {
    if (!uid || !picked || busy) return;
    const w = parseDecimal(weight);
    const r = Math.round(Number(reps));
    if (w === null || w < 0 || w > 500) return setError('Poids entre 0 et 500 kg');
    if (!(r >= 1 && r <= 100)) return setError('Répétitions entre 1 et 100');

    setBusy(true);
    setError(null);
    try {
      let exerciseId = picked.id;
      if (!exerciseId) {
        const created = await createExercise(uid, picked.name);
        exerciseId = created.id;
      }
      let sessionId = (await fetchTodaySession(uid, params.date))?.id;
      if (!sessionId) {
        const created = await createSession(uid, params.date, params.templateId ?? null, null);
        sessionId = created.id;
      }
      const order = params.nextOrder ? Number(params.nextOrder) : 1;
      await addSet(sessionId, { id: exerciseId, name: picked.name }, w, r, order);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackHeader title="Ajouter une série" />

      {picked ? (
        <Card>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>{picked.name}</Text>
          <Field label="Poids (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" />
          <Field label="Répétitions" value={reps} onChangeText={setReps} keyboardType="numeric" />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title="Enregistrer la série" onPress={save} disabled={busy || !weight || !reps} />
          {!params.exerciseName && <Button secondary title="Changer d'exercice" onPress={() => setPicked(null)} />}
        </Card>
      ) : (
        <Card>
          <Field label="Exercice (2 lettres minimum)" value={query} onChangeText={setQuery} autoCapitalize="none" />
          {query.trim().length >= 2 && results.length === 0 && (
            <Pressable onPress={() => setPicked({ id: null, name: query.trim() })}
              style={{ paddingVertical: 10 }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Créer "{query.trim()}"</Text>
            </Pressable>
          )}
          {results.map((ex) => (
            <Pressable key={ex.id} onPress={() => setPicked(ex)}
              style={{ backgroundColor: colors.cardAlt, borderRadius: 12, padding: 12, marginBottom: 6 }}>
              <Text>{ex.name}</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
