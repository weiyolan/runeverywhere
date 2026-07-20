/** Shared settings chrome: section label + chevron rows (P5 F). */
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  radius,
  spacing,
  tracking,
  typeScale,
} from '@/theme/theme';

export function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

export function SettingsRow({
  label,
  subtitle,
  right,
  danger = false,
  onPress,
}: {
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.rowDanger]}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.ink400} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sp2 },
  sectionLabel: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.dEyebrow,
    letterSpacing: letterSpacing(typeScale.dEyebrow, tracking.label),
    color: colors.ink400,
  },
  group: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    paddingHorizontal: spacing.sp4,
    paddingVertical: spacing.sp3 + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink100,
  },
  rowText: { flex: 1, gap: 1 },
  rowLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: colors.ink900,
  },
  rowDanger: { color: colors.danger },
  rowSubtitle: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
    color: colors.ink500,
  },
});
