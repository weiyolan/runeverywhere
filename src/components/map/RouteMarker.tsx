/**
 * RouteMarker — port of `project/components/run/RouteMarker.d.ts` (P2 C6).
 * Start dot / finish flag / closed-loop ring for route previews. P2 uses
 * "start" (detail mini-map, create pin) and "closed"; "finish" ships for P4.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radius, runType, shadows, type RunType } from '@/theme/theme';

export interface RouteMarkerProps {
  /** "start" point dot · "finish" flag · "closed" loop ring. */
  kind?: 'start' | 'finish' | 'closed';
  type?: RunType;
  size?: number;
}

export function RouteMarker({ kind = 'start', type = 'discover', size = 22 }: RouteMarkerProps) {
  const color = runType[type].main;
  const base = {
    width: size,
    height: size,
    borderRadius: radius.pill,
  };

  if (kind === 'closed') {
    // Loop: type-color ring with a repeat arrow
    return (
      <View style={[base, styles.ring, { borderColor: color }]}>
        <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
          <Path
            d="M21 12a9 9 0 1 1-3-6.7M21 3v5h-5"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
    );
  }

  if (kind === 'finish') {
    return (
      <View style={[base, styles.solid, { backgroundColor: color }]}>
        <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24">
          <Path
            d="M5 3v18M5 4h11l-2 4 2 4H5"
            fill={colors.paper}
            stroke={colors.paper}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }

  // Start: filled type-color dot with a white ring + inner white dot
  return (
    <View style={[base, styles.solid, styles.start, { backgroundColor: color }]}>
      <View
        style={{
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: radius.pill,
          backgroundColor: colors.paper,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    backgroundColor: colors.paper,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  solid: {
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  start: {
    borderWidth: 3,
    borderColor: colors.paper,
  },
});

export default RouteMarker;
