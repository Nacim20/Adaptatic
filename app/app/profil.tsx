import { useCallback, useEffect, useState } from 'react';
import { updateWaterTarget } from '../lib/journal';
import { parseDecimal } from '../lib/nutrition';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { Button, Card, Field, Row, Screen, Text, colors, styles } from '../lib/theme';
import { ACTIVITY_LABELS, GOAL_LABELS, Profile } from '../lib/types';
import { BackHeader } from '../lib/ui';

export default function Profil() {
  const { session } = useSession();
  const uid = session?.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [water, setWater] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle().then(({ data }) => {
      const p = data as Profile | null;
      setProfile(p);
      if (p) setWater(String(p.water_target_ml));
    });
  }, [uid]);

  const saveWater = useCallback(async () => {
    if (!uid) return;
    const ml = parseDecimal(water);
    if (ml === null || ml < 500 || ml > 10000) return setMsg("Objectif d'eau entre 500 et 10 000 ml");
    setBusy(true);
    setMsg(null);
    try {
      await updateWaterTarget(uid, Math.round(ml));
      setMsg('Enregistré');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }, [uid, water]);

  return (
    <Screen>
      <BackHeader title="Profil" />
      <Card>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Compte</Text>
        <Text style={{ fontSize: 17, fontWeight: '600', marginTop: 2 }}>{session?.user.email}</Text>
      </Card>
      {profile && (
        <Card>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 4 }}>RÉGLAGES GÉNÉRAUX</Text>
          <Row label="Objectif" value={GOAL_LABELS[profile.goal]} />
          {profile.goal !== 'maintain' && <Row label="Rythme visé" value={`${profile.weekly_rate_pct} % / semaine`} />}
          <Row label="Activité" value={ACTIVITY_LABELS[profile.activity_level].split(' (')[0]} />
        </Card>
      )}
      {profile && (
        <Card>
          <Field label="Objectif d'eau (ml de boissons par jour)" value={water} onChangeText={setWater} keyboardType="numeric" />
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
            Repère : l'EFSA juge adéquats 2,0 L (femmes) et 2,5 L (hommes) d'eau totale par jour, aliments compris.
            Ajuste selon ta chaleur, ton activité, ton avis médical.
          </Text>
          {msg && <Text style={msg === 'Enregistré' ? { color: colors.green, marginBottom: 8 } : styles.error}>{msg}</Text>}
          <Button title="Enregistrer" onPress={saveWater} disabled={busy} />
        </Card>
      )}
      <Button secondary title="Se déconnecter" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
