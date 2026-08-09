import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop, Polyline } from 'react-native-svg';
import { colors } from './theme';

type Props = {
  data: number[];
  width: number;
  height?: number;
  strokeWidth?: number;
};

export function Sparkline({ data, width, height = 72, strokeWidth = 2.5 }: Props) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? colors.gain : colors.loss;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 10) - 5;
      return `${x},${y}`;
    })
    .join(' ');
  const area = `M0,${height} L${points.split(' ').map((p) => p).join(' L')} L${width},${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
          <Stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#fill)" />
      <Polyline points={points} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}
