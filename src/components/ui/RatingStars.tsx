/**
 * RatingStars — port of `project/components/data/RatingStars.d.ts` (P4 H1).
 * Display mode with partial fill via an overlaid clipped row; interactive
 * mode (onRate) uses 44pt touch targets.
 */
import { Star } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, typeScale } from '@/theme/theme';

export interface RatingStarsProps {
  /** 0..max, fractional allowed for display. */
  value?: number;
  max?: number;
  /** Star glyph size in px. */
  size?: number;
  /** Review count rendered as "(n)". */
  count?: number;
  showValue?: boolean;
  /** Interactive mode: tap star n → onRate(n). */
  onRate?: (stars: number) => void;
}

function StarRow({ max, size, color, fill }: { max: number; size: number; color: string; fill?: boolean }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={size} color={color} fill={fill ? color : 'transparent'} />
      ))}
    </View>
  );
}

export function RatingStars({
  value = 0,
  max = 5,
  size = 16,
  count,
  showValue = false,
  onRate,
}: RatingStarsProps) {
  if (onRate) {
    return (
      <View style={styles.row}>
        {Array.from({ length: max }, (_, i) => {
          const n = i + 1;
          const active = value >= n;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
              onPress={() => onRate(n)}
              hitSlop={6}
              style={styles.touchTarget}
            >
              <Star
                size={size}
                color={active ? colors.star : colors.ink300}
                fill={active ? colors.star : 'transparent'}
              />
            </Pressable>
          );
        })}
      </View>
    );
  }

  const fillWidth = Math.max(0, Math.min(1, value / max));
  const rowWidth = max * size + (max - 1) * GAP;
  return (
    <View style={styles.row}>
      <View>
        <StarRow max={max} size={size} color={colors.ink200} fill />
        <View style={[styles.mask, { width: fillWidth * rowWidth }]}>
          <StarRow max={max} size={size} color={colors.star} fill />
        </View>
      </View>
      {showValue ? <Text style={[styles.value, { fontSize: size * 0.85 }]}>{value.toFixed(1)}</Text> : null}
      {count != null ? <Text style={[styles.count, { fontSize: size * 0.8 }]}>({count})</Text> : null}
    </View>
  );
}

const GAP = 2;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
  mask: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  touchTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: fonts.displaySemiBold,
    color: colors.ink900,
    fontVariant: ['tabular-nums'],
    marginLeft: 4,
  },
  count: {
    fontFamily: fonts.body,
    color: colors.ink400,
    fontSize: typeScale.tXs,
  },
});

export default RatingStars;
