/**
 * Segmented (P1 D3) — full-width segmented control; 48px segments in a
 * mid-bordered white container, selected segment ink900/white.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  tracking,
  typeScale,
} from '@/theme/theme';

export interface SegmentedProps<V extends string> {
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}

export function Segmented<V extends string>({ options, value, onChange }: SegmentedProps<V>) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.label, { color: selected ? colors.paper : colors.ink500 }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink200,
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.ink900,
  },
  label: {
    fontFamily: fonts.display,
    fontSize: typeScale.tSm,
    letterSpacing: letterSpacing(typeScale.tSm, tracking.caps),
  },
});
