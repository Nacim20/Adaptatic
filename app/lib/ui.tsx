import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { todayLabel } from './dates';
import { Card, Text, colors } from './theme';

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

const s = StyleSheet.create({
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
