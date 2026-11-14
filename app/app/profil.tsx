import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { Button, Card, Row, Screen, Text, colors } from '../lib/theme';
import { ACTIVITY_LABELS, GOAL_LABELS, Profile } from '../lib/types';

export default function Profil() {
  const router = useRouter();
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
  }, [session]);

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 16 }}>Retour</Text>
      </Pressable>
      <Text style={{ fontSize: 26, fontWeight: '700', marginBottom: 16 }}>Profil</Text>
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
      <Button secondary title="Se déconnecter" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
