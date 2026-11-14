import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { deviceTimeZone, localDateISO } from '../../lib/dates';
import { Button, Card, Field, Screen, Text, colors, styles } from '../../lib/theme';
import { NutritionTargets, Profile, WeightLog } from '../../lib/types';
import { ScreenHeader } from '../../lib/ui';

export default function Dashboard() {
  const { session } = useSession();
  const uid = session?.user.id;
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const [p, t, w] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('nutrition_targets').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('weight_logs').select('id,weight_kg,logged_on').eq('user_id', uid)
        .order('logged_on', { ascending: false }).limit(14),
    ]);
    if (p.error || t.error || w.error) {
      setError('Chargement impossible. Réessaie dans un instant.');
      setProfile((prev) => prev ?? null);
      return;
    }
    const prof = p.data as Profile | null;
    setProfile(prof);
    // « Aujourd'hui » dépend du fuseau : on le garde à jour (voyage, changement d'appareil).
    // Au mieux : en cas d'échec, la prochaine ouverture réessaie.
    const tz = deviceTimeZone();
    if (prof && prof.timezone !== tz) {
      supabase.from('profiles').update({ timezone: tz }).eq('user_id', uid).then(() => {});
    }
    setTargets(t.data as NutritionTargets | null);
    setWeights((w.data ?? []) as WeightLog[]);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  // Le service Java écrit nutrition_targets : on se met à jour en direct.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase.channel('targets')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'nutrition_targets', filter: `user_id=eq.${uid}` },
        (payload) => setTargets(payload.new as NutritionTargets))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid]);

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

  if (profile === undefined) return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.bg }} color={colors.primary} />;
  if (profile === null && !error) return <Redirect href="/onboarding" />;

  return (
    <Screen>
      <ScreenHeader title="Aperçu" />
      {error && <Text style={styles.error}>{error}</Text>}

      <Card>
        <Text style={styles.label}>Objectif calorique</Text>
        {targets ? (
          <>
            <Text style={styles.big}>{targets.calories_kcal} <Text style={{ fontSize: 16 }}>kcal</Text></Text>
            <View style={[styles.row, { marginTop: 8 }]}>
              <Text>Protéines {targets.protein_g} g</Text>
              <Text>Glucides {targets.carbs_g} g</Text>
              <Text>Lipides {targets.fat_g} g</Text>
            </View>
            <Text style={{ color: colors.muted, marginTop: 10 }}>
              Dépense estimée : {targets.tdee_kcal} kcal
              {targets.adaptive_offset_kcal !== 0 && ` · ajustement ${targets.adaptive_offset_kcal > 0 ? '+' : ''}${targets.adaptive_offset_kcal} kcal`}
            </Text>
            {targets.note && <Text style={{ marginTop: 6 }}>{targets.note}</Text>}
          </>
        ) : (
          <Text>Calcul en cours… (le service de calcul doit être démarré, voir docs/setup.md)</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.label}>Tendance du poids</Text>
        <Text style={styles.big}>
          {targets?.weight_trend_kg != null ? `${targets.weight_trend_kg.toFixed(1)} kg` : '—'}
        </Text>
        <Text style={{ color: colors.muted }}>
          {targets?.weekly_rate_kg != null
            ? `${targets.weekly_rate_kg > 0 ? '+' : ''}${targets.weekly_rate_kg.toFixed(2)} kg / semaine (14 derniers jours)`
            : 'Pèse-toi régulièrement : 5 pesées sur 14 jours suffisent pour mesurer ta tendance.'}
        </Text>
      </Card>

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
