import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { Button, Card, Choice, Field, styles } from '../lib/theme';
import { ACTIVITY_LABELS, ActivityLevel, GOAL_LABELS, Goal, Sex } from '../lib/types';

const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export default function Onboarding() {
  const router = useRouter();
  const { session } = useSession();
  const [sex, setSex] = useState<Sex>('male');
  const [birth, setBirth] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<Goal>('cut');
  const [rate, setRate] = useState('0.5');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!session) return;
    const h = Number(height.replace(',', '.'));
    const w = Number(weight.replace(',', '.'));
    const r = goal === 'maintain' ? 0 : Number(rate.replace(',', '.'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || Number.isNaN(Date.parse(birth))) return setError('Date de naissance : AAAA-MM-JJ');
    if (!(h >= 100 && h <= 250)) return setError('Taille entre 100 et 250 cm');
    if (!(w >= 30 && w <= 300)) return setError('Poids entre 30 et 300 kg');
    if (!(r >= 0 && r <= (goal === 'bulk' ? 0.5 : 1))) return setError(`Rythme entre 0 et ${goal === 'bulk' ? 0.5 : 1} %/semaine`);

    setBusy(true);
    setError(null);
    try {
      // Pesée d'abord : le trigger profil déclenchera un recalcul qui trouvera déjà un poids.
      const uid = session.user.id;
      const w1 = await supabase.from('weight_logs').upsert(
        { user_id: uid, weight_kg: w, logged_on: new Date().toISOString().slice(0, 10) },
        { onConflict: 'user_id,logged_on' });
      if (w1.error) throw w1.error;
      const p = await supabase.from('profiles').upsert({
        user_id: uid, sex, birth_date: birth, height_cm: h, activity_level: activity, goal, weekly_rate_pct: r,
      });
      if (p.error) throw p.error;
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Ton profil</Text>
        <Text style={styles.subtitle}>Quelques infos pour calculer tes objectifs de départ.</Text>
        <Card>
          <Choice label="Sexe (pour la formule métabolique)" value={sex} onChange={setSex}
            options={[{ value: 'male', label: 'Homme' }, { value: 'female', label: 'Femme' }]} />
          <Field label="Date de naissance (AAAA-MM-JJ)" value={birth} onChangeText={setBirth} placeholder="2004-05-21" />
          <Field label="Taille (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" />
          <Field label="Poids actuel (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" />
          <Choice label="Activité" value={activity} onChange={setActivity} options={toOptions(ACTIVITY_LABELS)} />
          <Choice label="Objectif" value={goal} onChange={setGoal} options={toOptions(GOAL_LABELS)} />
          {goal !== 'maintain' && (
            <Field label="Rythme visé (% du poids par semaine, 0,5 conseillé)" value={rate}
              onChangeText={setRate} keyboardType="numeric" />
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title="Calculer mes objectifs" onPress={save} disabled={busy} />
        </Card>
      </View>
    </ScrollView>
  );
}
