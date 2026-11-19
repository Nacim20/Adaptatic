import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { cancelEvent, declareEvent, fetchActiveEvent } from '../../lib/events';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { Button, Card, Field, Screen, Text, colors, styles } from '../../lib/theme';
import { CalorieEvent, NutritionTargets } from '../../lib/types';
import { ScreenHeader } from '../../lib/ui';

export default function Imprevu() {
  const { session } = useSession();
  const uid = session?.user.id;

  const [active, setActive] = useState<CalorieEvent | null | undefined>(undefined);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [excess, setExcess] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const [ev, t] = await Promise.all([
        fetchActiveEvent(uid),
        supabase.from('nutrition_targets').select('*').eq('user_id', uid).maybeSingle(),
      ]);
      setActive(ev);
      setTargets(t.data as NutritionTargets | null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible');
    }
  }, [uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function declare() {
    const kcal = Math.round(Number(excess.replace(',', '.')));
    if (!uid || !(kcal >= 1 && kcal <= 5000) || busy) {
      return setError('Entre un écart entre 1 et 5000 kcal.');
    }
    setBusy(true);
    try {
      await declareEvent(uid, kcal);
      setExcess('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imprévu impossible à enregistrer');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!active || busy) return;
    setBusy(true);
    try {
      await cancelEvent(active.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Annulation impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Imprévu" />
      {error && <Text style={styles.error}>{error}</Text>}

      {active ? (
        <Card>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 6 }}>Imprévu en cours</Text>
          <Text style={{ color: colors.muted, marginBottom: 10 }}>
            Déclaré le {active.event_date} : +{active.excess_kcal} kcal estimés.
          </Text>
          <Text style={{ marginBottom: 12 }}>
            {targets && targets.event_offset_kcal !== 0
              ? `Aujourd'hui, ton objectif est réduit de ${-targets.event_offset_kcal} kcal pour compenser.`
              : "L'effet sur ton objectif du jour apparaîtra ici une fois le calcul fait."}
          </Text>
          <Button secondary title="Annuler cet imprévu" onPress={cancel} disabled={busy} />
        </Card>
      ) : (
        <Card>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 6 }}>Signaler un imprévu</Text>
          <Text style={{ color: colors.muted, marginBottom: 12 }}>
            Restaurant, écart, voyage, semaine chargée… Déclare l'écart que tu estimes toi-même, et ton
            objectif des prochains jours s'ajuste pour absorber la différence, sans double effort le
            lendemain. Un seul imprévu actif à la fois.
          </Text>
          <Field label="Écart estimé (kcal)" value={excess} onChangeText={setExcess} keyboardType="numeric" />
          <Button title="Enregistrer mon imprévu" onPress={declare} disabled={busy || !excess} />
        </Card>
      )}
    </Screen>
  );
}
