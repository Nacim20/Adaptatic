import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSession } from '../lib/session';
import { Button, Card, Screen, Text, colors, styles } from '../lib/theme';
import { WorkoutTemplate } from '../lib/types';
import { BackHeader } from '../lib/ui';
import { fetchSplit, fetchTemplates, setSplitDay } from '../lib/workout';

/** Lun..Dim affiché, mais stocké en weekday Postgres (0 = dimanche … 6 = samedi). */
const DAYS: { weekday: number; label: string }[] = [
  { weekday: 1, label: 'Lundi' }, { weekday: 2, label: 'Mardi' }, { weekday: 3, label: 'Mercredi' },
  { weekday: 4, label: 'Jeudi' }, { weekday: 5, label: 'Vendredi' }, { weekday: 6, label: 'Samedi' },
  { weekday: 0, label: 'Dimanche' },
];

export default function Split() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [split, setSplit] = useState<Record<number, string | null>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    Promise.all([fetchTemplates(uid), fetchSplit(uid)])
      .then(([t, s]) => {
        setTemplates(t);
        const m: Record<number, string | null> = {};
        for (const row of s) m[row.weekday] = row.template_id;
        setSplit(m);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible'));
  }, [uid]);

  async function pick(weekday: number, templateId: string | null) {
    if (!uid) return;
    setSplit((prev) => ({ ...prev, [weekday]: templateId }));
    try {
      await setSplitDay(uid, weekday, templateId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
    }
  }

  if (templates.length === 0) {
    return (
      <Screen>
        <BackHeader title="Ton split hebdomadaire" />
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 14 }}>
          Crée d'abord au moins une séance type pour pouvoir l'assigner à un jour.
        </Text>
        <Button title="Créer une séance" onPress={() => router.push('/templates')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader title="Ton split hebdomadaire" />
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 14 }}>
        Associe une séance à chaque jour (ou laisse "Repos") — c'est toi qui définis ton programme.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {DAYS.map(({ weekday, label }) => (
        <Card key={weekday}>
          <Text style={{ fontWeight: '700', fontSize: 14.5, marginBottom: 8 }}>{label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable onPress={() => pick(weekday, null)}
              style={[s.chip, split[weekday] == null && s.chipActive]}>
              <Text style={{ fontSize: 13, fontWeight: '600' }}>Repos</Text>
            </Pressable>
            {templates.map((t) => (
              <Pressable key={t.id} onPress={() => pick(weekday, t.id)}
                style={[s.chip, split[weekday] === t.id && s.chipActive]}>
                <Text style={{ fontSize: 13, fontWeight: '600' }}>{t.name}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ))}

      <Button secondary title="Gérer mes séances" onPress={() => router.push('/templates')} />
    </Screen>
  );
}

const s = {
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(10,132,255,0.14)' },
};
