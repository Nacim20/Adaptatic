import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

export const colors = {
  bg: '#f6f7f9',
  card: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  primary: '#2563eb',
  border: '#e5e7eb',
  error: '#b91c1c',
};

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
      style={[styles.button, secondary && styles.buttonSecondary, disabled && { opacity: 0.5 }]}
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
          <Text style={{ color: value === o.value ? '#fff' : colors.text }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: colors.bg, padding: 16, alignItems: 'center' },
  container: { width: '100%', maxWidth: 520 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subtitle: { color: colors.muted, marginBottom: 16 },
  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10,
    backgroundColor: '#fff', color: colors.text, fontSize: 16,
  },
  button: { backgroundColor: colors.primary, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 6, backgroundColor: '#fff' },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  error: { color: colors.error, marginBottom: 8 },
  big: { fontSize: 40, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
