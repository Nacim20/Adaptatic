import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors } from './theme';
import { TrendPoint } from './weightTrend';

const HEIGHT = 140;
const PAD = 10;

function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Poids brut (points) et tendance lissée (trait) sur la période donnée. Largeur = celle du conteneur. */
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
  const x = (date: string) => PAD + ((toDayNumber(date) - firstDay) / daySpan) * (width - 2 * PAD);
  const y = (kg: number) => PAD + (1 - (kg - min) / span) * (HEIGHT - 2 * PAD);

  const trendLine = points.map((p) => `${x(p.date)},${y(p.trend)}`).join(' ');

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={HEIGHT}>
        <Line x1={PAD} y1={HEIGHT / 2} x2={width - PAD} y2={HEIGHT / 2} stroke={colors.border} strokeWidth={1} />
        <Polyline points={trendLine} fill="none" stroke={colors.primary} strokeWidth={2.5} />
        {points.map((p) => (
          <Circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={2.5} fill={colors.muted} />
        ))}
      </Svg>
    </View>
  );
}
