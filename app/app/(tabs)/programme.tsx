import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { dayLabel } from '../../lib/nutrition';
import { localDateISO } from '../../lib/dates';
import { fetchForecast } from '../../lib/service';
import { Screen, Text, colors, styles } from '../../lib/theme';
import { ForecastDay } from '../../lib/types';
import { ScreenHeader } from '../../lib/ui';

function dateChip(iso: string): { weekday: string; day: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return {
    weekday: date.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase(),
    day: String(d),
  };
}

export default function Programme() {
  const [days, setDays] = useState<ForecastDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    fetchForecast(7).then(setDays).catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible'));
  }, []));

  const today = localDateISO();

  return (
    <Screen>
      <ScreenHeader title="Programme" />
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 14 }}>
        Ton plan des 7 prochains jours, recalculé à chaque ouverture.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {!days && !error && <Text style={{ color: colors.muted }}>Calcul en cours…</Text>}

      {days?.map((d) => {
        const isToday = d.date === today;
        const chip = dateChip(d.date);
        return (
          <View key={d.date} style={[s.row, isToday && s.rowToday]}>
            <View style={[s.chip, isToday && s.chipToday]}>
              <Text style={{ fontSize: 9.5, fontWeight: '700', color: isToday ? colors.primary : colors.muted }}>{chip.weekday}</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', marginTop: 1 }}>{chip.day}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 14.5 }}>{dayLabel(d.date, today)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
                P {d.proteinG} · G {d.carbsG} · L {d.fatG}
              </Text>
              {d.eventOffsetKcal !== 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="flash" size={11} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: '600' }}>imprévu {d.eventOffsetKcal} kcal</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800' }}>{d.caloriesKcal}</Text>
          </View>
        );
      })}
    </Screen>
  );
}

const s = {
  row: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 12, marginBottom: 10,
  },
  rowToday: { borderColor: colors.primary, backgroundColor: 'rgba(10,132,255,0.08)' },
  chip: {
    width: 44, height: 50, borderRadius: 12, backgroundColor: colors.cardAlt,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  chipToday: { backgroundColor: 'rgba(10,132,255,0.16)' },
};
