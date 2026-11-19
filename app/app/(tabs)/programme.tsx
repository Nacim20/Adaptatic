import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { dayLabel } from '../../lib/nutrition';
import { localDateISO } from '../../lib/dates';
import { fetchForecast } from '../../lib/service';
import { Card, Screen, Text, colors, styles } from '../../lib/theme';
import { ForecastDay } from '../../lib/types';
import { ScreenHeader } from '../../lib/ui';

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
      {error && <Text style={styles.error}>{error}</Text>}

      {!days && !error && <Text style={{ color: colors.muted }}>Calcul en cours…</Text>}

      {days?.map((d) => (
        <Card key={d.date}>
          <View style={[styles.row, { alignItems: 'center' }]}>
            <Text style={{ fontWeight: '700' }}>{dayLabel(d.date, today)}</Text>
            <Text style={{ fontWeight: '700' }}>{d.caloriesKcal} kcal</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            P {d.proteinG} · G {d.carbsG} · L {d.fatG}
            {d.eventOffsetKcal !== 0 && ` · imprévu ${d.eventOffsetKcal} kcal`}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
