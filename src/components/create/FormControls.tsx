/**
 * Shared wizard/edit form controls: selectable chip + stepper row.
 * Used by create/details and run/[id]/manage edit mode.
 */
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  semantic,
  sizing,
  spacing,
  typeScale,
} from '@/theme/theme';

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({
  onMinus,
  onPlus,
  children,
}: {
  onMinus: () => void;
  onPlus: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.stepperRow}>
      <IconButton accessibilityLabel="Decrease" onPress={onMinus}>
        <Minus size={20} />
      </IconButton>
      {children}
      <IconButton accessibilityLabel="Increase" onPress={onPlus}>
        <Plus size={20} />
      </IconButton>
    </View>
  );
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;

const styles = StyleSheet.create({
  chip: {
    height: sizing.controlHXs,
    paddingHorizontal: spacing.sp3,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipSelected: { backgroundColor: colors.ink900, borderColor: colors.ink900 },
  chipText: {
    fontFamily: fonts.display,
    fontSize: typeScale.tXs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.ink700,
  },
  chipTextSelected: { color: colors.paper },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    paddingHorizontal: spacing.sp4,
    paddingVertical: spacing.sp3,
  },
});
