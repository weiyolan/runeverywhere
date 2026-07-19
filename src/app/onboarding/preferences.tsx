import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Segmented } from '@/components/onboarding/Segmented';
import { SelectChip } from '@/components/onboarding/SelectChip';
import { StepShell } from '@/components/onboarding/StepShell';
import { updateProfile } from '@/lib/profile';
import { useSession } from '@/stores/session';
import { colors, spacing, textStyles } from '@/theme/theme';
import type { Database } from '@/types/database.types';

type PaceBand = Database['public']['Enums']['pace_band'];
type DistanceBand = Database['public']['Enums']['distance_band'];

// Schema's 4 pace bands win over the flow file's 3 options (P1 decision 3).
const PACE_COPY: Record<PaceBand, string> = {
  easy: '6:30 /km and up — relaxed, conversational.',
  steady: '5:30–6:30 /km — steady, sustainable effort.',
  quick: '4:45–5:30 /km — brisk training pace.',
  fast: 'Sub 4:45 /km — quick, competitive sessions.',
};

const DISTANCES: { value: DistanceBand; label: string; caption: string }[] = [
  { value: 'short', label: 'SHORT', caption: 'up to 5K' },
  { value: 'mid', label: 'MID', caption: '5–10K' },
  { value: 'long', label: 'LONG', caption: '10K–half' },
  { value: 'ultra', label: 'ULTRA', caption: 'beyond half' },
];

// Uppercase ISO-639-1 codes, matching the seed's '{EN,PT}' format (decision 4).
const LANGUAGES: { code: string; label: string }[] = [
  { code: 'EN', label: 'English' },
  { code: 'PT', label: 'Português' },
  { code: 'ES', label: 'Español' },
  { code: 'FR', label: 'Français' },
  { code: 'DE', label: 'Deutsch' },
  { code: 'IT', label: 'Italiano' },
];

/** Step 3/4 "HOW DO YOU RUN?" (P1 H4) — pace, distance, languages. */
export default function OnboardingPreferencesScreen() {
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [pace, setPace] = useState<PaceBand>(profile?.pace_band ?? 'steady');
  const [distance, setDistance] = useState<DistanceBand>(profile?.distance_band ?? 'mid');
  const [languages, setLanguages] = useState<string[]>(
    profile?.languages.length ? profile.languages : ['EN'],
  );
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLanguage = (code: string) =>
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      await updateProfile({ pace_band: pace, distance_band: distance, languages });
      await refreshProfile();
      router.push('/onboarding/finish');
    } catch {
      setError('Could not save — check your connection and try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <StepShell
      step={3}
      onBack={() => router.back()}
      title="HOW DO YOU RUN?"
      subtitle="We use this to match you with the right runs."
      ctaDisabled={languages.length === 0}
      working={working}
      error={error}
      onContinue={() => void submit()}
    >
      <View style={styles.section}>
        <Text style={textStyles.eyebrow}>USUAL PACE</Text>
        <Segmented
          options={[
            { value: 'easy', label: 'EASY' },
            { value: 'steady', label: 'STEADY' },
            { value: 'quick', label: 'QUICK' },
            { value: 'fast', label: 'FAST' },
          ]}
          value={pace}
          onChange={setPace}
        />
        <View style={styles.paceCopyRow}>
          <View style={styles.voltDot} />
          <Text style={textStyles.caption}>{PACE_COPY[pace]}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={textStyles.eyebrow}>USUAL DISTANCE</Text>
        <View style={styles.chipRow}>
          {DISTANCES.map((d) => (
            <SelectChip
              key={d.value}
              label={d.label}
              caption={d.caption}
              selected={distance === d.value}
              onPress={() => setDistance(d.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={textStyles.eyebrow}>LANGUAGES · PICK ANY</Text>
        <View style={styles.chipRow}>
          {LANGUAGES.map((l) => (
            <SelectChip
              key={l.code}
              label={l.label}
              selected={languages.includes(l.code)}
              onPress={() => toggleLanguage(l.code)}
            />
          ))}
        </View>
      </View>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sp3,
  },
  paceCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
  },
  voltDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.volt,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sp2,
  },
});
