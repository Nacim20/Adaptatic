import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { localDateISO } from '../../lib/dates';
import { fetchActiveEvent } from '../../lib/events';
import { addWater, deleteWater, fetchDay } from '../../lib/journal';
import { defaultMealForHour, deficitDisplay, sumNutrients } from '../../lib/nutrition';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { Card, Screen, Text, colors, styles } from '../../lib/theme';
import { CalorieEvent, MEALS, MEAL_LABELS, MealEntry, NutritionTargets, Profile, WaterLog } from '../../lib/types';
import { MEAL_ICONS, MEAL_TINTS, ProgressBar, ProgressRing, ScreenHeader } from '../../lib/ui';

const WATER_STEP_ML = 250;

export default function Dashboard() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const today = localDateISO();

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [water, setWater] = useState<WaterLog[]>([]);
  const [waterTarget, setWaterTarget] = useState(2000);
  const [activeEvent, setActiveEvent] = useState<CalorieEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const [p, t, day, ev] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('nutrition_targets').select('*').eq('user_id', uid).maybeSingle(),
      fetchDay(uid, today),
      fetchActiveEvent(uid).catch(() => null),
    ]);
    if (p.error || t.error) {
      setError('Chargement impossible. Réessaie dans un instant.');
      setProfile((prev) => prev ?? null);
      return;
    }
    const prof = p.data as Profile | null;
    setProfile(prof);
    if (prof) setWaterTarget(prof.water_target_ml);
    setTargets(t.data as NutritionTargets | null);
    setEntries(day.entries);
    setWater(day.water);
    setActiveEvent(ev);
    setError(null);
  }, [uid, today]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Le service Java écrit nutrition_targets : on se met à jour en direct.
  useFocusEffect(useCallback(() => {
    if (!uid) return;
    const channel = supabase.channel('targets')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'nutrition_targets', filter: `user_id=eq.${uid}` },
        (payload) => setTargets(payload.new as NutritionTargets))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid]));

  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusy(false);
      load();
    }
  }

  if (profile === undefined) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (profile === null && !error) return <Redirect href="/onboarding" />;

  const total = sumNutrients(entries);
  const waterMl = water.reduce((s, w) => s + w.amount_ml, 0);
  const quickMeal = defaultMealForHour(new Date().getHours());

  const macros = [
    { label: 'PROTÉINES', value: total.protein_g, target: targets?.protein_g, color: colors.green },
    { label: 'GLUCIDES', value: total.carbs_g, target: targets?.carbs_g, color: colors.orange },
    { label: 'LIPIDES', value: total.fat_g, target: targets?.fat_g, color: colors.red },
  ];

  const deficit = targets && profile
    ? deficitDisplay(profile.goal, targets.tdee_kcal, targets.calories_kcal, total.kcal)
    : null;

  return (
    <Screen>
      <ScreenHeader title="Accueil" />
      {error && <Text style={styles.error}>{error}</Text>}

      <LinearGradient colors={[colors.cardAlt, colors.card]} style={s.ringCard}>
        {deficit && profile ? (
          <ProgressRing
            fraction={deficit.fraction}
            value={String(deficit.kcal)}
            unit="kcal"
            label={deficit.label.toUpperCase()}
            color={profile.goal === 'bulk' ? colors.orange : colors.teal}
          />
        ) : (
          <ProgressRing fraction={0} value="—" label="CALCUL EN COURS" color={colors.muted} />
        )}

        <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 16, gap: 10 }}>
          <View style={s.statCol}>
            <Text style={s.statLabel}>CONSOMMÉES</Text>
            <Text style={[s.statValue, { color: colors.primary }]}>{Math.round(total.kcal)} <Text style={s.statUnit}>kcal</Text></Text>
            <View style={[s.statBar, { backgroundColor: colors.primary }]} />
          </View>
          <View style={s.statCol}>
            <Text style={s.statLabel}>DÉPENSE ESTIMÉE</Text>
            <Text style={[s.statValue, { color: colors.orange }]}>{targets ? targets.tdee_kcal : '—'} <Text style={s.statUnit}>kcal</Text></Text>
            <View style={[s.statBar, { backgroundColor: colors.orange }]} />
          </View>
        </View>

        {!targets && (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
            Le service de calcul doit tourner, voir docs/setup.md.
          </Text>
        )}
      </LinearGradient>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        {macros.map((m) => (
          <View key={m.label} style={s.macroCard}>
            <View style={[styles.row, { alignItems: 'center' }]}>
              <Text style={{ fontSize: 10.5, color: colors.muted, fontWeight: '700', letterSpacing: 0.3 }}>{m.label}</Text>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: m.color }} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', marginVertical: 6 }}>
              {Math.round(m.value)}<Text style={{ fontSize: 11, color: colors.muted, fontWeight: '500' }}>/{m.target ?? '—'}g</Text>
            </Text>
            <ProgressBar value={m.value} target={m.target} color={m.color} />
          </View>
        ))}
      </View>

      <Card>
        <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 12 }}>Récapitulatif de la journée</Text>

        <View style={s.summaryRow}>
          <View style={[s.dot, { backgroundColor: colors.primary }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600', fontSize: 13.5 }}>
              Repas : {MEALS.filter((m) => entries.some((e) => e.meal === m)).length} / {MEALS.length} enregistrés
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
              {MEALS.filter((m) => entries.some((e) => e.meal === m)).map((m) => MEAL_LABELS[m]).join(', ') || 'Rien noté pour l\'instant'}
            </Text>
          </View>
        </View>

        <View style={s.summaryRow}>
          <View style={[s.dot, { backgroundColor: colors.teal }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600', fontSize: 13.5 }}>
              Hydratation : {(waterMl / 1000).toFixed(2).replace(/\.?0+$/, '')}L / {(waterTarget / 1000).toFixed(1)}L
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
              {waterMl >= waterTarget ? 'Objectif atteint' : `Il reste ${((waterTarget - waterMl) / 1000).toFixed(2).replace(/\.?0+$/, '')}L`}
            </Text>
          </View>
        </View>

        <View style={[s.summaryRow, { marginBottom: 0 }]}>
          <View style={[s.dot, { backgroundColor: activeEvent ? colors.primary : colors.border }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600', fontSize: 13.5 }}>
              Imprévu : {activeEvent ? 'en cours' : 'aucun'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
              {activeEvent ? `Déclaré le ${activeEvent.event_date}, +${activeEvent.excess_kcal} kcal` : "Rien à signaler"}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={[styles.row, { alignItems: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={s.waterIcon}>
              <Ionicons name="water-outline" size={20} color={colors.teal} />
            </View>
            <View>
              <Text style={{ fontWeight: '600' }}>Hydratation</Text>
              <Text style={{ color: colors.teal, fontWeight: '700' }}>
                {(waterMl / 1000).toFixed(2).replace(/\.?0+$/, '')}L / {(waterTarget / 1000).toFixed(1)}L
              </Text>
            </View>
          </View>
          <Pressable disabled={busy} onPress={() => uid && act(() => addWater(uid, today, WATER_STEP_ML))}
            style={{ backgroundColor: colors.teal, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, opacity: busy ? 0.6 : 1 }}>
            <Text style={{ fontWeight: '700', color: '#042' }}>+ {WATER_STEP_ML} ml</Text>
          </Pressable>
        </View>
        {water.length > 0 && (
          <Pressable disabled={busy} onPress={() => act(() => deleteWater(water[water.length - 1].id))} style={{ marginTop: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Annuler le dernier ajout ({water[water.length - 1].amount_ml} ml)</Text>
          </Pressable>
        )}
      </Card>

      <View style={[styles.row, { alignItems: 'baseline', marginBottom: 10 }]}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>Aujourd'hui</Text>
        <Pressable onPress={() => router.push('/(tabs)/nutrition')}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Tout le journal</Text>
        </Pressable>
      </View>

      {MEALS.map((meal) => {
        const items = entries.filter((e) => e.meal === meal);
        const sub = sumNutrients(items);
        return (
          <Pressable key={meal} onPress={() => router.push({ pathname: '/add-food', params: { meal, date: today } })} style={s.mealRow}>
            <View style={[s.waterIcon, { backgroundColor: MEAL_TINTS[meal] }]}>
              <Ionicons name={MEAL_ICONS[meal]} size={19} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', fontSize: 14.5 }}>{MEAL_LABELS[meal]}</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 1 }}>
                {items.length === 0 ? 'Rien noté' : `${items.length} aliment${items.length > 1 ? 's' : ''} · ${Math.round(sub.kcal)} kcal`}
              </Text>
            </View>
            <View style={[s.addButton, meal === quickMeal && { borderColor: colors.primary }]}>
              <Ionicons name="add" size={18} color={colors.primary} />
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const s = {
  ringCard: {
    borderRadius: 24, padding: 20, marginBottom: 14, alignItems: 'center' as const,
    borderWidth: 1, borderColor: colors.border,
  },
  statCol: { flex: 1, alignItems: 'center' as const },
  statLabel: { fontSize: 10.5, color: colors.muted, fontWeight: '700' as const, letterSpacing: 0.4, marginBottom: 4 },
  statValue: { fontSize: 19, fontWeight: '800' as const },
  statUnit: { fontSize: 12, fontWeight: '600' as const },
  statBar: { height: 3, width: '70%' as const, borderRadius: 2, marginTop: 8, opacity: 0.8 },
  summaryRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 10, marginBottom: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  macroCard: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 11,
  },
  waterIcon: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: colors.cardAlt,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 12,
  },
  mealRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, marginBottom: 10,
  },
  addButton: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
};
