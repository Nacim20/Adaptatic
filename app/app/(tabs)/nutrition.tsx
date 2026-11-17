import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { localDateISO } from '../../lib/dates';
import {
  addEntryFromPast, addWater, deleteEntry, deleteWater, fetchDay, fetchRecentEntries,
} from '../../lib/journal';
import { dayLabel, defaultMealForHour, recentDistinct, shiftDate, sumNutrients } from '../../lib/nutrition';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { Button, Card, Screen, Text, colors, styles } from '../../lib/theme';
import { MEALS, MEAL_LABELS, MealEntry, NutritionTargets, WaterLog } from '../../lib/types';
import { ProgressBar, ScreenHeader } from '../../lib/ui';

const WATER_STEP_ML = 250;

export default function Nutrition() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const today = localDateISO();

  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [water, setWater] = useState<WaterLog[]>([]);
  const [recents, setRecents] = useState<MealEntry[]>([]);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [waterTarget, setWaterTarget] = useState(2000);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0); // ignore les réponses d'un jour que l'utilisateur a déjà quitté

  const load = useCallback(async () => {
    if (!uid) return;
    const id = ++latest.current;
    try {
      const [day, rec, t, p] = await Promise.all([
        fetchDay(uid, date),
        fetchRecentEntries(uid),
        supabase.from('nutrition_targets').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('profiles').select('water_target_ml').eq('user_id', uid).maybeSingle(),
      ]);
      if (id !== latest.current) return;
      setEntries(day.entries);
      setWater(day.water);
      setRecents(rec);
      setTargets(t.data as NutritionTargets | null);
      if (p.data) setWaterTarget((p.data as { water_target_ml: number }).water_target_ml);
      setError(null);
    } catch (e) {
      if (id === latest.current) setError(e instanceof Error ? e.message : 'Chargement impossible');
    }
  }, [uid, date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** Exécute une action, évite les doubles appuis, puis recharge. */
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusy(false);
      load();
    }
  }

  const total = sumNutrients(entries);
  const waterMl = water.reduce((s, w) => s + w.amount_ml, 0);
  const quick = recentDistinct(recents.filter((r) => r.food_id), 4);
  const quickMeal = defaultMealForHour(new Date().getHours());
  const over = targets ? Math.round(total.kcal - targets.calories_kcal) : 0;

  const macros = [
    { label: 'PROTÉINES', value: total.protein_g, target: targets?.protein_g, color: colors.green },
    { label: 'GLUCIDES', value: total.carbs_g, target: targets?.carbs_g, color: colors.orange },
    { label: 'LIPIDES', value: total.fat_g, target: targets?.fat_g, color: colors.red },
  ];

  return (
    <Screen>
      <ScreenHeader title="Nutrition" />

      <View style={[styles.row, { alignItems: 'center', marginBottom: 14 }]}>
        <Pressable accessibilityLabel="Jour précédent" onPress={() => setDate(shiftDate(date, -1))} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={{ fontWeight: '600', fontSize: 16 }}>{dayLabel(date, today)}</Text>
        <Pressable accessibilityLabel="Jour suivant" disabled={date >= today} hitSlop={12}
          onPress={() => setDate(shiftDate(date, 1))} style={{ opacity: date >= today ? 0.25 : 1 }}>
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Card>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', letterSpacing: 0.5 }}>ÉNERGIE QUOTIDIENNE</Text>
        <Text style={{ fontSize: 34, fontWeight: '800', textAlign: 'center', marginTop: 4 }}>
          {Math.round(total.kcal)}
          {targets && <Text style={{ color: colors.teal }}> / {targets.calories_kcal} Kcal</Text>}
          {!targets && <Text style={{ color: colors.teal }}> Kcal</Text>}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginBottom: 14 }}>
          {date === today ? "consommées aujourd'hui" : 'consommées ce jour-là'}
        </Text>
        {macros.map((m) => (
          <View key={m.label} style={{ marginBottom: 10 }}>
            <View style={[styles.row, { marginBottom: 4 }]}>
              <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5 }}>{m.label}</Text>
              <Text style={{ fontSize: 13 }}>
                {Math.round(m.value)}g{m.target ? <Text style={{ color: colors.muted }}> / {m.target}g</Text> : null}
              </Text>
            </View>
            <ProgressBar value={m.value} target={m.target} color={m.color} />
          </View>
        ))}
        {over > 0 && (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            {over} kcal au-dessus de ta cible. Un jour ne change pas ta tendance : c'est la moyenne de la semaine qui compte.
          </Text>
        )}
        {!targets && (
          <Text style={{ color: colors.muted, fontSize: 12 }}>Ta cible apparaîtra dès que ton objectif sera calculé (voir Accueil).</Text>
        )}
      </Card>

      <Card>
        <View style={[styles.row, { alignItems: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="water-outline" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontWeight: '600' }}>Hydratation</Text>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {(waterMl / 1000).toFixed(2).replace(/\.?0+$/, '')}L / {(waterTarget / 1000).toFixed(1)}L
              </Text>
            </View>
          </View>
          <Pressable disabled={busy} onPress={() => uid && act(() => addWater(uid, date, WATER_STEP_ML))}
            style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, opacity: busy ? 0.6 : 1 }}>
            <Text style={{ fontWeight: '700' }}>+ {WATER_STEP_ML} ml</Text>
          </Pressable>
        </View>
        {water.length > 0 && (
          <Pressable disabled={busy} onPress={() => act(() => deleteWater(water[water.length - 1].id))} style={{ marginTop: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Annuler le dernier ajout ({water[water.length - 1].amount_ml} ml)</Text>
          </Pressable>
        )}
      </Card>

      {MEALS.map((meal) => {
        const items = entries.filter((e) => e.meal === meal);
        const sub = sumNutrients(items);
        return (
          <Card key={meal}>
            <View style={[styles.row, { alignItems: 'center' }]}>
              <View>
                <Text style={{ fontWeight: '700', fontSize: 16 }}>{MEAL_LABELS[meal]}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {Math.round(sub.kcal)} kcal · P {Math.round(sub.protein_g)} · G {Math.round(sub.carbs_g)} · L {Math.round(sub.fat_g)}
                </Text>
              </View>
              <Pressable accessibilityLabel={`Ajouter au ${MEAL_LABELS[meal]}`} hitSlop={8}
                onPress={() => router.push({ pathname: '/add-food', params: { meal, date } })}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>
            {items.length === 0 ? (
              <Text style={{ color: colors.muted, marginTop: 10, fontSize: 13 }}>Rien d'enregistré.</Text>
            ) : (
              items.map((e) => (
                <View key={e.id} style={[styles.row, { alignItems: 'center', paddingTop: 10 }]}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text numberOfLines={1}>{e.food_name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{e.quantity_g} g · {Math.round(e.kcal)} kcal</Text>
                  </View>
                  <Pressable accessibilityLabel={`Supprimer ${e.food_name}`} disabled={busy} hitSlop={10}
                    onPress={() => act(() => deleteEntry(e.id))}>
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        );
      })}

      {quick.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>Ajout rapide</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
            Même quantité que la dernière fois, ajouté à : {MEAL_LABELS[quickMeal]}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {quick.map((q) => (
              <View key={q.id} style={{ width: '48.5%', backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <Text numberOfLines={1} style={{ fontWeight: '600' }}>{q.food_name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{q.quantity_g} g · {Math.round(q.kcal)} kcal</Text>
                </View>
                <Pressable accessibilityLabel={`Ajouter ${q.food_name}`} disabled={busy}
                  onPress={() => uid && act(() => addEntryFromPast(uid, { date, meal: quickMeal, past: q }))}
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={18} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      <Button title="Ajouter un aliment" onPress={() => router.push({ pathname: '/add-food', params: { meal: quickMeal, date } })} />
    </Screen>
  );
}
