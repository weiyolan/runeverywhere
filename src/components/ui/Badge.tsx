/**
 * Badge — port of `project/components/data/Badge.d.ts` (P2 C2).
 * Small status/meta pill: "4 SPOTS LEFT", "FULL", "PENDING", "+120 PTS".
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, letterSpacing, radius, tracking, typeScale } from '@/theme/theme';

export type BadgeTone = 'neutral' | 'ink' | 'volt' | 'go' | 'warn' | 'danger' | 'star';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  /** Solid = tone fill + contrast text; default soft tint + tone text. */
  solid?: boolean;
}

const TONES: Record<BadgeTone, { softBg: string; softFg: string; solidBg: string; solidFg: string }> = {
  neutral: { softBg: colors.ink100, softFg: colors.ink700, solidBg: colors.ink700, solidFg: colors.paper },
  ink: { softBg: colors.ink900, softFg: colors.paper, solidBg: colors.ink900, solidFg: colors.paper },
  volt: { softBg: colors.volt, softFg: colors.voltInk, solidBg: colors.volt, solidFg: colors.voltInk },
  go: { softBg: colors.goSoft, softFg: colors.go, solidBg: colors.go, solidFg: colors.paper },
  warn: { softBg: colors.warnSoft, softFg: colors.warn, solidBg: colors.warn, solidFg: colors.ink900 },
  danger: { softBg: colors.dangerSoft, softFg: colors.danger, solidBg: colors.danger, solidFg: colors.paper },
  star: { softBg: colors.star, softFg: colors.ink900, solidBg: colors.star, solidFg: colors.ink900 },
};

export function Badge({ children, tone = 'neutral', icon, solid = false }: BadgeProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: solid ? t.solidBg : t.softBg }]}>
      {icon}
      <Text style={[styles.text, { color: solid ? t.solidFg : t.softFg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  text: {
    fontFamily: fonts.display,
    fontSize: typeScale.t2xs,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing(typeScale.t2xs, tracking.caps),
    lineHeight: 14,
  },
});

export default Badge;
