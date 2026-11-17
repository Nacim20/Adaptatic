import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { todayLabel } from './dates';
import { Card, Text, colors } from './theme';
import { ratio } from './nutrition';

/** En-tête des écrans : date en bleu, titre, avatar qui ouvre le profil. */
export function ScreenHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View style={s.header}>
      <View>
        <Text style={s.date}>{todayLabel()}</Text>
        <Text style={s.title}>{title}</Text>
      </View>
      <Pressable accessibilityLabel="Ouvrir le profil" onPress={() => router.push('/profil')} style={s.avatar}>
        <Ionicons name="person-outline" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

/** Écran d'une fonctionnalité pas encore construite : dit honnêtement ce qui viendra. */
export function ComingSoon({ headline, description }: { headline: string; description: string }) {
  return (
    <Card>
      <Text style={s.headline}>{headline}</Text>
      <Text style={{ color: colors.muted }}>{description}</Text>
      <Text style={s.badge}>BIENTÔT</Text>
    </Card>
  );
}

/** Barre de progression. Au-delà de l'objectif elle reste pleine : aucune alerte, aucun rouge. */
export function ProgressBar({ value, target, color }: { value: number; target: number | null | undefined; color: string }) {
  return (
    <View style={s.track}>
      <View style={{ width: `${ratio(value, target) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

/** Puce sélectionnable. */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, selected && s.chipOn]}>
      <Text style={{ fontSize: 14, fontWeight: selected ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

/** En-tête des écrans secondaires (hors onglets) : bouton retour + titre. */
export function BackHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View style={{ marginBottom: 14 }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }} accessibilityLabel="Retour">
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 16 }}>Retour</Text>
      </Pressable>
      <Text style={s.title}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.cardAlt, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: colors.primary },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  date: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  title: { fontSize: 26, fontWeight: '700' },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  headline: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  badge: { color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 12, letterSpacing: 0.6 },
});
