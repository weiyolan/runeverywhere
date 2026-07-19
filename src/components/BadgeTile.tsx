/**
 * Badge tile (P5 E3) — earned = tinted icon block, locked = dimmed.
 * Icon names come from the catalog (lucide kebab names).
 */
import {
  Flag,
  Flame,
  Footprints,
  MapPin,
  Medal,
  Mountain,
  Repeat,
  Star,
  Sunrise,
  Sunset,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { BadgeWithEarned } from '@/lib/profile';
import { colors, fonts, letterSpacing, radius, spacing, tracking, typeScale } from '@/theme/theme';

const ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  repeat: Repeat,
  flame: Flame,
  flag: Flag,
  users: Users,
  medal: Medal,
  trophy: Trophy,
  sunrise: Sunrise,
  sunset: Sunset,
  'map-pin': MapPin,
  mountain: Mountain,
  star: Star,
};

const TINTS: Record<string, { bg: string; fg: string }> = {
  discover: { bg: colors.discoverSoft, fg: colors.discover },
  challenge: { bg: colors.challengeSoft, fg: colors.challenge },
  social: { bg: colors.socialSoft, fg: colors.social },
  go: { bg: colors.goSoft, fg: colors.go },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  star: { bg: colors.warnSoft, fg: colors.star },
  volt: { bg: colors.volt, fg: colors.voltInk },
};

export function BadgeTile({ badge, showDescription = false }: { badge: BadgeWithEarned; showDescription?: boolean }) {
  const earned = badge.earned_at != null;
  const Icon = ICONS[badge.icon] ?? Star;
  const tint = TINTS[badge.color] ?? TINTS.go;
  return (
    <View style={[styles.tile, !earned && styles.locked]}>
      <View style={[styles.iconBlock, { backgroundColor: earned ? tint.bg : colors.paper3 }]}>
        <Icon size={22} color={earned ? tint.fg : colors.ink400} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {badge.name}
      </Text>
      {showDescription ? (
        <Text style={styles.description} numberOfLines={2}>
          {badge.description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    gap: spacing.sp1,
    width: 96,
  },
  locked: { opacity: 0.65 },
  iconBlock: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.t2xs,
    letterSpacing: letterSpacing(typeScale.t2xs, tracking.label),
    color: colors.ink900,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.ink500,
    textAlign: 'center',
  },
});
