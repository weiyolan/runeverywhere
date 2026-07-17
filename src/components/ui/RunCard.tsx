/**
 * RunCard — port of `project/components/run/RunCard.d.ts`.
 * The core discovery object: a planned run, color-coded by type with a 5px
 * left accent rail, quoted goal, key stats and host strip. Used across
 * Explore list, Your Runs, search, and map sheets.
 */
import { Image } from 'expo-image';
import { Check, Repeat, Star } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  borderWidth,
  colors,
  fonts,
  lineHeight,
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
  /** Avatar photo URL; initials fallback when unset. */
  src?: string;
  rating?: number;
  verified?: boolean;
}

export interface RunAttendee {
  name: string;
  src?: string;
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
  /** No visual (per design JSX) — used in the spots accessibility label. */
  spotsTotal?: number | null;
  /** Closed loop vs point-to-point. */
  closedLoop?: boolean;
  attendees?: RunAttendee[];
  /** "default" list · "compact" map sheet/search · "feature" hero. */
  variant?: 'default' | 'compact' | 'feature';
  onPress?: () => void;
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const MAX_ATTENDEES = 3;

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
  spotsTotal,
  closedLoop,
  attendees,
  variant = 'default',
  onPress,
}: RunCardProps) {
  const t = runType[type];
  const compact = variant === 'compact';
  const feature = variant === 'feature';
  const isFull = spotsLeft != null && spotsLeft <= 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, feature ? shadows.lg : shadows.sm]}
    >
      {/* Signature motif: 5px accent rail in the run-type color */}
      <View style={[styles.rail, { backgroundColor: t.main }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <TypeChip type={type} size="sm" />
          {spotsLeft != null ? (
            <View
              accessibilityLabel={
                spotsTotal != null ? `${spotsLeft} of ${spotsTotal} spots left` : undefined
              }
              style={[styles.spots, { backgroundColor: isFull ? colors.ink100 : colors.warnSoft }]}
            >
              <Text style={[styles.spotsText, { color: isFull ? semantic.textMuted : colors.warn }]}>
                {isFull ? 'FULL' : `${spotsLeft} SPOTS LEFT`}
              </Text>
            </View>
          ) : null}
        </View>

        <Text numberOfLines={1} style={[styles.title, feature && styles.titleFeature]}>
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
            <View>
              {host.src ? (
                <Image source={{ uri: host.src }} style={styles.hostPhoto} />
              ) : (
                <View style={[styles.hostAvatar, { backgroundColor: t.soft }]}>
                  <Text style={[styles.hostInitials, { color: t.main }]}>
                    {initials(host.name)}
                  </Text>
                </View>
              )}
              {host.verified ? (
                <View accessibilityLabel="Verified host" style={styles.verified}>
                  <Check size={10} color={colors.paper} strokeWidth={3} />
                </View>
              ) : null}
            </View>
            <Text style={styles.hostName}>{host.name}</Text>
            {host.rating != null ? (
              <View style={styles.rating}>
                <Star size={12} color={colors.star} fill={colors.star} />
                <Text style={styles.ratingValue}>{host.rating.toFixed(1)}</Text>
              </View>
            ) : null}
            <View style={styles.hostRowEnd}>
              {attendees?.length ? (
                <View style={styles.attendees}>
                  {attendees.slice(0, MAX_ATTENDEES).map((a, i) => (
                    <View key={i} style={[styles.attendee, i > 0 && styles.attendeeOverlap]}>
                      {a.src ? (
                        <Image source={{ uri: a.src }} style={styles.attendeePhoto} />
                      ) : (
                        <Text style={styles.attendeeInitials}>{initials(a.name)}</Text>
                      )}
                    </View>
                  ))}
                  {attendees.length > MAX_ATTENDEES ? (
                    <View style={[styles.attendee, styles.attendeeOverlap, styles.attendeeMore]}>
                      <Text style={styles.attendeeMoreText}>
                        +{attendees.length - MAX_ATTENDEES}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {closedLoop ? (
                <View accessibilityLabel="Closed loop">
                  <Repeat size={18} color={t.main} />
                </View>
              ) : null}
            </View>
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
  titleFeature: {
    fontSize: 26,
    lineHeight: 26 * lineHeight.snug,
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
  hostPhoto: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
  },
  hostInitials: {
    fontFamily: fonts.display,
    fontSize: 10,
  },
  /** 16px is Avatar.jsx's minWidth/minHeight floor for the verified tick. */
  verified: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.go,
    borderWidth: borderWidth.bold,
    borderColor: semantic.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
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
  hostRowEnd: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
  },
  attendees: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /** 28px = the design's `xs` Avatar size (Avatar.jsx dims.xs). */
  attendee: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: borderWidth.bold,
    borderColor: semantic.bgSurface,
    backgroundColor: colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  attendeeOverlap: {
    marginLeft: -8,
  },
  attendeePhoto: {
    width: '100%',
    height: '100%',
  },
  attendeeInitials: {
    fontFamily: fonts.displayBlack,
    fontSize: 11,
    color: colors.voltInk,
  },
  attendeeMore: {
    backgroundColor: semantic.bgInverse,
  },
  attendeeMoreText: {
    fontFamily: fonts.displayExtra,
    fontSize: 11,
    color: semantic.textOnDark,
  },
});

export default RunCard;
