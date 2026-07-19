/**
 * SelectChip (P1 D3) — 42px pill chip; selected = ink fill / white text,
 * unselected = white with mid border (flow HTML chipStyle). Optional
 * sub-caption for the distance-band ranges.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  motion,
  radius,
  tracking,
  typeScale,
} from '@/theme/theme';

export interface SelectChipProps {
  label: string;
  /** Small lowercase range caption after the label (e.g. "5–10K"). */
  caption?: string;
  selected: boolean;
  onPress: () => void;
}

export function SelectChip({ label, caption, selected, onPress }: SelectChipProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.chip,
        selected ? styles.selected : styles.unselected,
        { transform: [{ scale: pressed ? motion.pressScale : 1 }] },
      ]}
    >
      <Text style={[styles.label, { color: selected ? colors.paper : colors.ink900 }]}>{label}</Text>
      {caption ? (
        <Text style={[styles.caption, { color: selected ? colors.ink300 : colors.ink400 }]}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selected: {
    backgroundColor: colors.ink900,
  },
  unselected: {
    backgroundColor: colors.paper,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink200,
  },
  label: {
    fontFamily: fonts.display,
    fontSize: typeScale.tSm,
    letterSpacing: letterSpacing(typeScale.tSm, tracking.caps),
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
  },
});
