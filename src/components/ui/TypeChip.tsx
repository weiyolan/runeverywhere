/**
 * TypeChip — port of `project/components/data/TypeChip.d.ts`.
 * Three locked run types only; category coding, never decoration.
 */
import { StyleSheet, Text, View } from 'react-native';

import { fonts, letterSpacing, radius, runType, tracking, type RunType } from '@/theme/theme';

export interface TypeChipProps {
  type: RunType;
  /** solid = type color fill; soft = tinted background, type-colored text. */
  chipStyle?: 'solid' | 'soft';
  size?: 'sm' | 'md';
  /** Override label text (rarely needed); colors still come from `type`. */
  custom?: string;
}

export function TypeChip({ type, chipStyle = 'solid', size = 'md', custom }: TypeChipProps) {
  const t = runType[type];
  const solid = chipStyle === 'solid';
  const fontSize = size === 'sm' ? 10 : 12;

  return (
    <View
      style={[
        styles.chip,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: solid ? t.main : t.soft },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize,
          color: solid ? t.ink : t.main,
          textTransform: 'uppercase',
          letterSpacing: letterSpacing(fontSize, tracking.label),
        }}
      >
        {custom ?? t.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { paddingHorizontal: 8, height: 20 },
  md: { paddingHorizontal: 12, height: 26 },
});

export default TypeChip;
