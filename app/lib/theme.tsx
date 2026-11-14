import { ReactNode } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, TextInputProps, TextProps, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Palette de la maquette : fond noir OLED, cartes gris très foncé, accent bleu iOS. */
export const colors = {
  bg: '#000000',
  tabBar: '#0a0a0b',
  card: '#141416',
  cardAlt: '#1c1c1f',
  border: '#26262a',
  text: '#ffffff',
  muted: '#8e8e93',
  primary: '#0a84ff',
  teal: '#2dd4bf',
  orange: '#ff9f0a',
  green: '#30d158',
  red: '#ff453a',
  error: '#ff6b6b',
};

/** Text avec la couleur par défaut du thème (React Native met du noir par défaut). */
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ color: colors.text }, style]} />;
}

/** Page défilante : gère les zones sûres (encoche, barre d'état) et la largeur maximale. */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Button({ title, onPress, disabled, secondary }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, !secondary && styles.buttonGlow, secondary && styles.buttonSecondary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function Choice<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)}
          style={[styles.choice, value === o.value && styles.choiceActive]}>
          <Text>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Ligne « libellé / valeur » des listes de réglages. */
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.row, styles.settingsRow]}>
      <Text>{label}</Text>
      <Text style={{ color: colors.muted }}>{value}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 16, alignItems: 'center' },
  container: { width: '100%', maxWidth: 520 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: colors.muted, marginBottom: 16 },
  card: {
    backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12,
    backgroundColor: colors.cardAlt, color: colors.text, fontSize: 16,
  },
  button: { backgroundColor: colors.primary, padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  buttonGlow: {
    shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  choice: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 6,
    backgroundColor: colors.cardAlt,
  },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  error: { color: colors.error, marginBottom: 8 },
  big: { fontSize: 40, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  settingsRow: { paddingVertical: 10 },
});
