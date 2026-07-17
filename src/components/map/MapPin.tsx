/**
 * MapPin — port of `project/components/run/MapPin.d.ts` (P2 C5).
 * Teardrop pin color-coded by run type with a distance label, or a dark
 * cluster count bubble. Pure view (react-native-svg) — no map dependency, so
 * it renders inside AppMarker and the gallery alike.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, fonts, radius, runType, shadows, type RunType } from '@/theme/theme';

export interface MapPinProps {
  type?: RunType;
  /** Text inside the pin — distance ("5K") or, for clusters, a count. */
  label?: string;
  /** Enlarged + ink ring when tapped. */
  selected?: boolean;
  /** Render as a dark count bubble instead of a teardrop. */
  cluster?: boolean;
}

/** Teardrop outline from the design reference (viewBox 0 0 40 48). */
const TEARDROP = 'M20 1C9.5 1 1 9.3 1 19.6 1 32 20 47 20 47s19-15 19-27.4C39 9.3 30.5 1 20 1z';

export function MapPin({ type = 'discover', label = '', selected = false, cluster = false }: MapPinProps) {
  if (cluster) {
    return (
      <View style={styles.cluster}>
        <Text style={styles.clusterText}>{label}</Text>
      </View>
    );
  }

  const size = selected ? 52 : 40;
  const height = size * 1.2;

  return (
    <View style={[{ width: size, height }, shadows.pin]}>
      <Svg width={size} height={height} viewBox="0 0 40 48">
        <Path
          d={TEARDROP}
          fill={runType[type].main}
          stroke={selected ? colors.ink900 : colors.paper}
          strokeWidth={selected ? 3 : 2.5}
        />
        <Circle cx={20} cy={19} r={11} fill="rgba(255,255,255,0.18)" />
      </Svg>
      {/* Label centered over the teardrop's circular head (cy 19/48). */}
      <View style={[styles.labelWrap, { height: height * (19 / 48) * 2 }]}>
        <Text style={[styles.labelText, { fontSize: selected ? 15 : 12 }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.ink900,
    borderWidth: 2.5,
    borderColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.pin,
  },
  clusterText: {
    fontFamily: fonts.displayBlack,
    fontSize: 15,
    color: colors.paper,
  },
  labelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontFamily: fonts.displayBlack,
    color: colors.paper,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    lineHeight: 16,
  },
});

export default MapPin;
