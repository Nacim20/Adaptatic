import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ExerciseProgressChart, WeightChart } from '../../lib/chart';
import { localDateISO } from '../../lib/dates';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { Button, Card, Field, Screen, Text, colors, styles } from '../../lib/theme';
import { Exercise, NutritionTargets, WeightLog } from '../../lib/types';
import { ScreenHeader } from '../../lib/ui';
import { trendSeries } from '../../lib/weightTrend';
import { fetchAllExercises, fetchExerciseHistory } from '../../lib/workout';
import { topSetWeight } from '../../lib/workoutStats';

export default function Progres() {
  const { session } = useSession();
  const uid = session?.user.id;

  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [points, setPoints] = useState<{ date: string; topWeight: number }[]>([]);

  const load = useCallback(async () => {
    if (!uid) return;
    const [t, w, ex] = await Promise.all([
      supabase.from('nutrition_targets').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('weight_logs').select('id,weight_kg,logged_on').eq('user_id', uid)
        .order('logged_on', { ascending: false }).limit(90),
      fetchAllExercises(uid),
    ]);
    if (t.error || w.error) return setError('Chargement impossible. Réessaie dans un instant.');
    setTargets(t.data as NutritionTargets | null);
    setWeights((w.data ?? []) as WeightLog[]);
    setExercises(ex);
    setError(null);
  }, [uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function selectExercise(ex: Exercise) {
    setSelected(ex);
    if (!uid) return;
    const history = await fetchExerciseHistory(uid, ex.id);
    setPoints(
      history
        .map((h) => ({ date: h.performedOn, topWeight: topSetWeight(h.sets) }))
        .filter((p): p is { date: string; topWeight: number } => p.topWeight !== null),
    );
  }

  async function addWeight() {
    const kg = Number(input.replace(',', '.'));
    if (!(kg >= 30 && kg <= 300)) return setError('Poids entre 30 et 300 kg');
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from('weight_logs').upsert(
      { user_id: uid, weight_kg: kg, logged_on: localDateISO() },
      { onConflict: 'user_id,logged_on' });
    setBusy(false);
    if (e) return setError(e.message);
    setInput('');
    load();
  }

  const trend = targets?.weight_trend_kg ?? null;
  const rate = targets?.weekly_rate_kg ?? null;

  return (
    <Screen>
      <ScreenHeader title="Progrès" />
      {error && <Text style={styles.error}>{error}</Text>}

      <Card>
        <Text style={styles.label}>Tendance du poids</Text>
        <Text style={styles.big}>{trend != null ? `${trend.toFixed(1)} kg` : '—'}</Text>
        <Text style={{ color: rate != null ? (rate < 0 ? colors.green : colors.orange) : colors.muted, marginBottom: weights.length >= 2 ? 10 : 0 }}>
          {rate != null
            ? `${rate > 0 ? '+' : ''}${rate.toFixed(2)} kg / semaine (14 derniers jours)`
            : 'Pèse-toi régulièrement : 5 pesées sur 14 jours suffisent pour mesurer ta tendance.'}
        </Text>
        {weights.length >= 2 && (
          <WeightChart points={trendSeries(weights.map((w) => ({ date: w.logged_on, kg: w.weight_kg })))} />
        )}
      </Card>

      {exercises.length > 0 && (
        <Card>
          <Text style={styles.label}>Progrès à l'entraînement</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 10 }}>
            {exercises.map((ex) => (
              <Pressable key={ex.id} onPress={() => selectExercise(ex)}
                style={[s.chip, selected?.id === ex.id && s.chipActive]}>
                <Text style={{ fontSize: 12.5, fontWeight: '600' }}>{ex.name}</Text>
              </Pressable>
            ))}
          </View>
          {!selected && <Text style={{ color: colors.muted, fontSize: 13 }}>Choisis un exercice pour voir son évolution.</Text>}
          {selected && points.length > 0 && (
            <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 4 }}>
              {points[points.length - 1].topWeight} <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '600' }}>kg (meilleure série la plus récente)</Text>
            </Text>
          )}
          {selected && points.length === 0 && (
            <Text style={{ color: colors.muted, fontSize: 13 }}>Aucune série enregistrée pour {selected.name}.</Text>
          )}
          {selected && points.length === 1 && (
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Une seule journée enregistrée pour l'instant — la courbe apparaîtra dès que tu auras refait {selected.name} un autre jour.
            </Text>
          )}
          {selected && points.length >= 2 && <ExerciseProgressChart points={points} />}
        </Card>
      )}

      {targets?.note && (
        <Card>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{targets.note}</Text>
        </Card>
      )}

      <Card>
        <Field label="Ma pesée du jour (kg)" value={input} onChangeText={setInput} keyboardType="numeric" />
        <Button title="Enregistrer" onPress={addWeight} disabled={busy || !input} />
        {weights.map((w) => (
          <View key={w.id} style={[styles.row, { paddingTop: 8 }]}>
            <Text style={{ color: colors.muted }}>{w.logged_on}</Text>
            <Text>{w.weight_kg} kg</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const s = {
  chip: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14,
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(10,132,255,0.14)' },
};
