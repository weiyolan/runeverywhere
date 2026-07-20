import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Segmented } from '@/components/onboarding/Segmented';
import { StepShell } from '@/components/onboarding/StepShell';
import { updateProfile } from '@/lib/profile';
import { useSession } from '@/stores/session';
import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  radius,
  shadows,
  sizing,
  spacing,
  textStyles,
  tracking,
  typeScale,
} from '@/theme/theme';
import type { Database } from '@/types/database.types';

type Units = Database['public']['Enums']['units_pref'];
type Visibility = Database['public']['Enums']['profile_visibility'];

const VISIBILITIES: { value: Visibility; label: string; caption: string }[] = [
  { value: 'everyone', label: 'EVERYONE', caption: 'Anyone can view your profile' },
  { value: 'members', label: 'MEMBERS', caption: 'Only people in your runs' },
  { value: 'hidden', label: 'HIDDEN', caption: 'Only you' },
];

function SuccessView({ homeCity }: { homeCity: string | null }) {
  const insets = useSafeAreaInsets();
  const refreshProfile = useSession((s) => s.refreshProfile);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 160 });
  }, [scale]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={[styles.success, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.sp6 }]}>
      <StatusBar style="light" />
      <View style={styles.successBody}>
        <Animated.View style={[styles.checkCircle, pop]}>
          <Check size={54} color={colors.voltInk} strokeWidth={3} />
        </Animated.View>
        <Text style={styles.successTitle}>YOU&apos;RE IN</Text>
        <Text style={styles.successSub}>
          {homeCity
            ? `${homeCity} is full of runners. Let's find your first one.`
            : "There are runners near you right now. Let's find your first run."}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        style={styles.exploreButton}
        onPress={() => {
          void refreshProfile().then(() => router.replace('/(tabs)'));
        }}
      >
        <Text style={styles.exploreLabel}>START EXPLORING</Text>
      </Pressable>
    </View>
  );
}

/** Step 4/4 "ALMOST THERE" + success state (P1 H5, decisions 2 & 5). */
export default function OnboardingFinishScreen() {
  const profile = useSession((s) => s.profile);

  const [units, setUnits] = useState<Units>(profile?.units ?? 'km');
  const [visibility, setVisibility] = useState<Visibility>(profile?.visibility ?? 'everyone');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      // No refreshProfile here — the AuthGate would bounce to tabs and skip
      // the success screen (decision 13). Refresh happens on START EXPLORING.
      await updateProfile({ units, visibility, onboarded_at: new Date().toISOString() });
      setDone(true);
    } catch {
      setError('Could not save — check your connection and try again.');
    } finally {
      setWorking(false);
    }
  };

  if (done) return <SuccessView homeCity={profile?.home_city ?? null} />;

  return (
    <StepShell
      step={4}
      onBack={() => router.back()}
      title="ALMOST THERE"
      subtitle="You can change any of this later in Settings."
      ctaLabel="FINISH"
      working={working}
      error={error}
      onContinue={() => void submit()}
    >
      <View style={styles.section}>
        <Text style={textStyles.eyebrow}>UNITS</Text>
        <Segmented
          options={[
            { value: 'km', label: 'KM' },
            { value: 'mi', label: 'MI' },
          ]}
          value={units}
          onChange={setUnits}
        />
      </View>

      <View style={styles.section}>
        <Text style={textStyles.eyebrow}>PROFILE VISIBILITY</Text>
        <View style={styles.cards}>
          {VISIBILITIES.map((v) => {
            const selected = visibility === v.value;
            return (
              <Pressable
                key={v.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setVisibility(v.value)}
                style={[styles.card, selected && styles.cardSelected]}
              >
                <View style={styles.cardText}>
                  <Text style={styles.cardLabel}>{v.label}</Text>
                  <Text style={textStyles.caption}>{v.caption}</Text>
                </View>
                {selected ? <Check size={20} color={colors.ink900} strokeWidth={3} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sp3,
  },
  cards: {
    gap: spacing.sp3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paper,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    padding: spacing.sp4,
  },
  cardSelected: {
    borderColor: colors.ink900,
    borderWidth: borderWidth.bold,
  },
  cardText: {
    gap: 2,
  },
  cardLabel: {
    fontFamily: fonts.display,
    fontSize: typeScale.tMd,
    letterSpacing: letterSpacing(typeScale.tMd, tracking.caps),
    color: colors.ink900,
  },
  // Success state — ink bg, volt glow check, per the flow's SUCCESS frame.
  success: {
    flex: 1,
    backgroundColor: colors.ink900,
    paddingHorizontal: sizing.gutter,
    justifyContent: 'space-between',
  },
  successBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sp5,
  },
  checkCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.volt,
  },
  successTitle: {
    fontFamily: fonts.displayBlack,
    fontSize: typeScale.d1,
    color: colors.paper,
    letterSpacing: letterSpacing(typeScale.d1, tracking.tight),
  },
  successSub: {
    fontFamily: fonts.body,
    fontSize: typeScale.tMd,
    lineHeight: typeScale.tMd * 1.45,
    color: colors.ink300,
    textAlign: 'center',
  },
  exploreButton: {
    height: sizing.controlH,
    borderRadius: radius.sm,
    backgroundColor: colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.volt,
  },
  exploreLabel: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tMd,
    letterSpacing: letterSpacing(typeScale.tMd, tracking.caps),
    color: colors.voltInk,
  },
});
