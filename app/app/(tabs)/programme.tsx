import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { localDateISO } from '../../lib/dates';
import { dayLabel } from '../../lib/nutrition';
import { fetchForecast } from '../../lib/service';
import { useSession } from '../../lib/session';
import { Button, Card, Screen, Text, colors, styles } from '../../lib/theme';
import { ForecastDay, WorkoutSession, WorkoutSet, WorkoutTemplate, WorkoutTemplateExercise } from '../../lib/types';
import { ScreenHeader } from '../../lib/ui';
import { fetchSetsForSession, fetchSplit, fetchTemplateExercises, fetchTemplates, fetchTodaySession } from '../../lib/workout';
import { weekdayOf } from '../../lib/workoutStats';

function dateChip(iso: string): { weekday: string; day: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return {
    weekday: date.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase(),
    day: String(d),
  };
}

/** Affichage Lun → Dim, mais weekday reste la convention Postgres (0 = dimanche … 6 = samedi). */
const WEEK_DISPLAY = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export default function Programme() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const today = localDateISO();
  const todayWeekday = weekdayOf(today);

  const [days, setDays] = useState<ForecastDay[] | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [split, setSplit] = useState<Record<number, string | null>>({});
  const [todaySession, setTodaySession] = useState<WorkoutSession | null>(null);
  const [todaySets, setTodaySets] = useState<WorkoutSet[]>([]);
  const [todayExercises, setTodayExercises] = useState<WorkoutTemplateExercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!uid) return;
    Promise.all([fetchTemplates(uid), fetchSplit(uid), fetchTodaySession(uid, today)])
      .then(async ([tpls, splitRows, sess]) => {
        setTemplates(tpls);
        const m: Record<number, string | null> = {};
        for (const r of splitRows) m[r.weekday] = r.template_id;
        setSplit(m);
        setTodaySession(sess);

        const templateId = sess?.template_id ?? m[todayWeekday] ?? null;
        if (templateId) setTodayExercises(await fetchTemplateExercises(templateId));
        else setTodayExercises([]);

        setTodaySets(sess ? await fetchSetsForSession(sess.id) : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible'));
  }, [uid, today, todayWeekday]);

  useFocusEffect(useCallback(() => {
    fetchForecast(7).then(setDays).catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible'));
    load();
  }, [load]));

  const todayTemplateId = todaySession?.template_id ?? split[todayWeekday] ?? null;
  const todayTemplate = templates.find((t) => t.id === todayTemplateId) ?? null;
  const loggedByExercise: Record<string, WorkoutSet[]> = {};
  for (const s of todaySets) (loggedByExercise[s.exercise_id ?? s.exercise_name] ??= []).push(s);

  function logSlot(ex: WorkoutTemplateExercise, order: number) {
    router.push({
      pathname: '/log-set',
      params: {
        date: today, templateId: todayTemplateId ?? undefined,
        exerciseId: ex.exercise_id ?? undefined, exerciseName: ex.exercise_name, nextOrder: String(order),
      },
    });
  }

  function logFreeSet() {
    router.push({ pathname: '/log-set', params: { date: today, templateId: todayTemplateId ?? undefined, nextOrder: String(todaySets.length + 1) } });
  }

  return (
    <Screen>
      <ScreenHeader title="Programme" />
      {error && <Text style={styles.error}>{error}</Text>}

      <Card>
        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 }}>
          SÉANCE DU JOUR
        </Text>
        <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 10 }}>{todayTemplate?.name ?? 'Repos'}</Text>

        {todayTemplate && todayExercises.length > 0 ? (
          <View style={{ marginBottom: 12 }}>
            {todayExercises.map((ex, i) => {
              const done = ex.exercise_id ? loggedByExercise[ex.exercise_id] : undefined;
              return (
                <Pressable key={ex.id} onPress={() => logSlot(ex, i + 1)} style={[styles.row, { alignItems: 'center', paddingVertical: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '600' }}>{i + 1}. {ex.exercise_name}</Text>
                    {done ? (
                      <Text style={{ color: colors.green, fontSize: 12, marginTop: 1 }}>
                        {done.map((s) => `${s.weight_kg}kg×${s.reps}`).join(', ')}
                      </Text>
                    ) : (
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>Pas encore fait</Text>
                    )}
                  </View>
                  <Ionicons name={done ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={done ? colors.green : colors.primary} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          todaySets.length === 0 && (
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>
              Aucune séance prévue aujourd'hui. Choisis-en une dans ton split, ou enregistre librement.
            </Text>
          )
        )}

        {todaySets.filter((s) => !s.exercise_id || !todayExercises.some((e) => e.exercise_id === s.exercise_id)).map((s) => (
          <View key={s.id} style={[styles.row, { paddingVertical: 4 }]}>
            <Text style={{ fontSize: 13.5 }}>{s.exercise_name}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{s.weight_kg} kg × {s.reps}</Text>
          </View>
        ))}

        <Button secondary={todayExercises.length > 0} title="Ajouter un autre exercice" onPress={logFreeSet} />
      </Card>

      <View style={[styles.row, { alignItems: 'baseline', marginBottom: 10, marginTop: 4 }]}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>Ton split</Text>
        <Pressable onPress={() => router.push('/split')}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Modifier</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/split')} style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
        {WEEK_DISPLAY.map((w) => {
          const t = templates.find((tt) => tt.id === split[w]);
          return (
            <View key={w} style={[s.splitChip, w === todayWeekday && s.splitChipToday]}>
              <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700' }}>{WEEKDAY_SHORT[w]}</Text>
              <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '700', marginTop: 2 }}>{t?.name ?? '—'}</Text>
            </View>
          );
        })}
      </Pressable>

      {templates.length === 0 && (
        <Button secondary title="Créer ta première séance" onPress={() => router.push('/templates')} />
      )}

      <View style={[styles.row, { alignItems: 'baseline', marginBottom: 10, marginTop: 4 }]}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>Objectif calorique</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 14 }}>
        Ton plan des 7 prochains jours, recalculé à chaque ouverture.
      </Text>

      {!days && !error && <Text style={{ color: colors.muted }}>Calcul en cours…</Text>}

      {days?.map((d) => {
        const isToday = d.date === today;
        const chip = dateChip(d.date);
        return (
          <View key={d.date} style={[s.row, isToday && s.rowToday]}>
            <View style={[s.chip, isToday && s.chipToday]}>
              <Text style={{ fontSize: 9.5, fontWeight: '700', color: isToday ? colors.primary : colors.muted }}>{chip.weekday}</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', marginTop: 1 }}>{chip.day}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 14.5 }}>{dayLabel(d.date, today)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
                P {d.proteinG} · G {d.carbsG} · L {d.fatG}
              </Text>
              {d.eventOffsetKcal !== 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="flash" size={11} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: '600' }}>imprévu {d.eventOffsetKcal} kcal</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800' }}>{d.caloriesKcal}</Text>
          </View>
        );
      })}
    </Screen>
  );
}

const s = {
  row: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 12, marginBottom: 10,
  },
  rowToday: { borderColor: colors.primary, backgroundColor: 'rgba(10,132,255,0.08)' },
  chip: {
    width: 44, height: 50, borderRadius: 12, backgroundColor: colors.cardAlt,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  chipToday: { backgroundColor: 'rgba(10,132,255,0.16)' },
  splitChip: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingVertical: 8, alignItems: 'center' as const,
  },
  splitChipToday: { borderColor: colors.primary, backgroundColor: 'rgba(10,132,255,0.1)' },
};
