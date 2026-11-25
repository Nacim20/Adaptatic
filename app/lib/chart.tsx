import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors } from './theme';
import { TrendPoint } from './weightTrend';

const HEIGHT = 150;
const PAD_X = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 10;

function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Poids brut (points discrets) et tendance lissée (ligne, marqueurs en anneau) sur la période donnée. */
export function WeightChart({ points }: { points: TrendPoint[] }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (points.length < 2) return <View onLayout={onLayout} />;
  if (width === 0) return <View onLayout={onLayout} style={{ height: HEIGHT }} />;

  const kgs = points.map((p) => p.kg).concat(points.map((p) => p.trend));
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const span = Math.max(max - min, 0.5); // évite une échelle nulle si le poids n'a pas bougé

  // Proportionnel aux jours écoulés, pas à l'index : un trou de plusieurs semaines sans pesée
  // doit se voir comme un trou, pas comme des pesées quotidiennes compressées.
  const firstDay = toDayNumber(points[0].date);
  const daySpan = Math.max(toDayNumber(points[points.length - 1].date) - firstDay, 1);
  const x = (date: string) => PAD_X + ((toDayNumber(date) - firstDay) / daySpan) * (width - 2 * PAD_X);
  const y = (kg: number) => PAD_TOP + (1 - (kg - min) / span) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const trendLine = points.map((p) => `${x(p.date)},${y(p.trend)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={HEIGHT}>
        <Line x1={0} y1={HEIGHT / 2} x2={width} y2={HEIGHT / 2} stroke={colors.border} strokeWidth={1} strokeDasharray="4 5" />
        {points.map((p) => (
          <Circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={2} fill={colors.muted} opacity={0.5} />
        ))}
        <Polyline points={trendLine} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <Circle key={`m-${p.date}`} cx={x(p.date)} cy={y(p.trend)} r={4} fill={colors.card} stroke={colors.primary} strokeWidth={2.5} />
        ))}
        <Circle cx={x(last.date)} cy={y(last.trend)} r={5.5} fill={colors.primary} />
      </Svg>
    </View>
  );
}

/**
 * Progrès sur un exercice donné : la meilleure série (poids) de chaque séance où il a été fait,
 * au fil du temps réel (comme WeightChart). Juste les données de l'utilisateur, aucun lissage.
 */
export function ExerciseProgressChart({ points }: { points: { date: string; topWeight: number }[] }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (points.length < 2) return <View onLayout={onLayout} />;
  if (width === 0) return <View onLayout={onLayout} style={{ height: HEIGHT }} />;

  const weights = points.map((p) => p.topWeight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = Math.max(max - min, 0.5);

  const firstDay = toDayNumber(points[0].date);
  const daySpan = Math.max(toDayNumber(points[points.length - 1].date) - firstDay, 1);
  const x = (date: string) => PAD_X + ((toDayNumber(date) - firstDay) / daySpan) * (width - 2 * PAD_X);
  const y = (kg: number) => PAD_TOP + (1 - (kg - min) / span) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const line = points.map((p) => `${x(p.date)},${y(p.topWeight)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={HEIGHT}>
        <Polyline points={line} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <Circle key={p.date} cx={x(p.date)} cy={y(p.topWeight)} r={4} fill={colors.card} stroke={colors.primary} strokeWidth={2.5} />
        ))}
        <Circle cx={x(last.date)} cy={y(last.topWeight)} r={5.5} fill={colors.primary} />
      </Svg>
    </View>
  );
}
