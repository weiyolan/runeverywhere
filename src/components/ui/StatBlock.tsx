/**
 * StatBlock — port of `project/components/data/StatBlock.d.ts` (P2 C4).
 * Big condensed metric + uppercase label — the KM · /KM · DAY · TIME readouts.
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, letterSpacing, textStyles, tracking, typeScale } from '@/theme/theme';

export interface StatBlockProps {
  value: React.ReactNode;
  label: string;
  unit?: string;
  /** Value color (e.g. a run-type or volt token). */
  accent?: string;
  align?: 'center' | 'left';
  size?: 'sm' | 'md' | 'lg';
}

const VALUE_SIZES = { sm: 22, md: 30, lg: 40 } as const;

export function StatBlock({
  value,
  label,
  unit,
  accent = colors.ink900,
  align = 'center',
  size = 'md',
}: StatBlockProps) {
  const fontSize = VALUE_SIZES[size];
  return (
    <View style={[styles.block, align === 'center' ? styles.center : styles.left]}>
      <View style={styles.valueRow}>
        <Text
          style={{
            fontFamily: fonts.displayExtra,
            fontSize,
            lineHeight: fontSize,
            color: accent,
            fontVariant: ['tabular-nums'],
            letterSpacing: letterSpacing(fontSize, tracking.tight),
          }}
        >
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      <Text style={textStyles.eyebrow}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 2 },
  center: { alignItems: 'center' },
  left: { alignItems: 'flex-start' },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  unit: {
    fontFamily: fonts.display,
    fontSize: typeScale.tXs,
    color: colors.ink400,
    textTransform: 'uppercase',
  },
});

export default StatBlock;
