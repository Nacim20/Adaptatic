import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { todayLabel } from './dates';
import { Card, Text, colors } from './theme';
import { MealType } from './types';
import { ratio } from './nutrition';

/** Icône et teinte de chaque repas, partagées entre l'Accueil et le journal détaillé. */
export const MEAL_ICONS: Record<MealType, ComponentProps<typeof Ionicons>['name']> = {
  breakfast: 'sunny-outline', lunch: 'restaurant-outline', dinner: 'moon-outline', snack: 'cafe-outline',
};
export const MEAL_TINTS: Record<MealType, string> = {
  breakfast: 'rgba(255,159,10,0.16)', lunch: 'rgba(10,132,255,0.16)', dinner: 'rgba(45,212,191,0.16)', snack: 'rgba(48,209,88,0.16)',
};

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

/** Anneau de calories : consommées sur objectif, avec le nombre restant au centre. */
export function CalorieRing({ consumed, target, size = 180 }: { consumed: number; target: number | null; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = target ? Math.min(Math.max(consumed / target, 0), 1) : 0;
  const remaining = target != null ? Math.max(Math.round(target - consumed), 0) : null;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.cardAlt} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.primary} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - frac)} />
      </Svg>
      <Text style={{ fontSize: 34, fontWeight: '800' }}>{remaining ?? '—'}</Text>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '500' }}>
        {target != null ? 'kcal restantes' : 'objectif en calcul'}
      </Text>
    </View>
  );
}

/**
 * Anneau générique : l'appelant calcule lui-même la fraction remplie et ce qui s'affiche au
 * centre. Permet à deux écrans de montrer des anneaux avec un sens différent (ex. calories
 * restantes vs déficit du jour) sans dupliquer le dessin SVG.
 */
export function ProgressRing({ fraction, value, unit, label, color = colors.primary, size = 180 }: {
  fraction: number; value: string; unit?: string; label: string; color?: string; size?: number;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(fraction, 0), 1);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.cardAlt} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - clamped)} />
      </Svg>
      <Text style={{ fontSize: 34, fontWeight: '800' }}>{value}{unit && <Text style={{ fontSize: 16, fontWeight: '700' }}> {unit}</Text>}</Text>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '500', textAlign: 'center', marginTop: 2 }}>{label}</Text>
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
