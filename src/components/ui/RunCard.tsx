/**
 * RunCard — port of `project/components/run/RunCard.d.ts`.
 * The core discovery object: a planned run, color-coded by type with a 5px
 * left accent rail, quoted goal, key stats and host strip. Used across
 * Explore list, Your Runs, search, and map sheets.
 */
import { Star } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  borderWidth,
  colors,
  fonts,
  radius,
  runType,
  semantic,
  shadows,
  spacing,
  textStyles,
  typeScale,
  type RunType,
} from '@/theme/theme';

import { TypeChip } from './TypeChip';

export interface RunHost {
  name: string;
  rating?: number;
  verified?: boolean;
}

export interface RunCardProps {
  type: RunType;
  title: string;
  /** Free-text run goal, shown quoted (hidden in compact). */
  goal?: string;
  host?: RunHost;
  /** e.g. "5.2 km" */
  distance?: string;
  /** e.g. "5:30 /km" */
  pace?: string;
  /** e.g. "Tomorrow · 07:00" */
  when?: string;
  city?: string;
  /** Remaining spots; 0 or less renders FULL. */
  spotsLeft?: number | null;
  /** "default" list · "compact" map sheet/search. */
  variant?: 'default' | 'compact';
  onPress?: () => void;
}

export function RunCard({
  type,
  title,
  goal,
  host,
  distance,
  pace,
  when,
  city,
  spotsLeft,
  variant = 'default',
  onPress,
}: RunCardProps) {
  const t = runType[type];
  const compact = variant === 'compact';
  const isFull = spotsLeft != null && spotsLeft <= 0;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, shadows.sm]}>
      {/* Signature motif: 5px accent rail in the run-type color */}
      <View style={[styles.rail, { backgroundColor: t.main }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <TypeChip type={type} size="sm" />
          {spotsLeft != null ? (
            <View style={[styles.spots, { backgroundColor: isFull ? colors.ink100 : colors.warnSoft }]}>
              <Text style={[styles.spotsText, { color: isFull ? semantic.textMuted : colors.warn }]}>
                {isFull ? 'FULL' : `${spotsLeft} SPOTS LEFT`}
              </Text>
            </View>
          ) : null}
        </View>

        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>

        {!compact && goal ? (
          <Text numberOfLines={2} style={styles.goal}>
            “{goal}”
          </Text>
        ) : null}

        <View style={styles.statsRow}>
          {[distance, pace, when, compact ? undefined : city]
            .filter((s): s is string => Boolean(s))
            .map((stat, i) => (
              <Text key={stat} style={styles.stat}>
                {i > 0 ? '·  ' : ''}
                {stat}
              </Text>
            ))}
        </View>

        {host ? (
          <View style={styles.hostRow}>
            <View style={[styles.hostAvatar, { backgroundColor: t.soft }]}>
              <Text style={[styles.hostInitials, { color: t.main }]}>
                {host.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
            <Text style={styles.hostName}>{host.name}</Text>
            {host.rating != null ? (
              <View style={styles.rating}>
                <Star size={12} color={colors.star} fill={colors.star} />
                <Text style={styles.ratingValue}>{host.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: semantic.borderHairline,
    overflow: 'hidden',
  },
  rail: {
    width: 5,
  },
  body: {
    flex: 1,
    padding: spacing.sp4,
    gap: spacing.sp2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...textStyles.cardTitle,
  },
  goal: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: semantic.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stat: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.tSm,
    color: semantic.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  spots: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp2,
    paddingVertical: 2,
  },
  spotsText: {
    fontFamily: fonts.display,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
    marginTop: spacing.sp1,
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInitials: {
    fontFamily: fonts.display,
    fontSize: 10,
  },
  hostName: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: semantic.textPrimary,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingValue: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.tSm,
    color: semantic.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});

export default RunCard;
