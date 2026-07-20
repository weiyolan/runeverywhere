/** Preferences (P5 F4): units + profile visibility, optimistic with rollback. */
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Segmented } from '@/components/onboarding/Segmented';
import { IconButton } from '@/components/ui/IconButton';
import { updateProfile } from '@/lib/profile';
import { useSession } from '@/stores/session';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  sizing,
  spacing,
  textStyles,
  typeScale,
} from '@/theme/theme';
import type { Database } from '@/types/database.types';

type Units = Database['public']['Enums']['units_pref'];
type Visibility = Database['public']['Enums']['profile_visibility'];

const VISIBILITIES: { value: Visibility; label: string; caption: string }[] = [
  { value: 'everyone', label: 'EVERYONE', caption: 'Anyone on Run Everywhere can view your profile' },
  { value: 'members', label: 'MEMBERS', caption: 'Only runners who share a run with you see your full profile' },
  { value: 'hidden', label: 'HIDDEN', caption: 'Nobody can find or view your profile' },
];

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [units, setUnits] = useState<Units>(profile?.units ?? 'km');
  const [visibility, setVisibility] = useState<Visibility>(profile?.visibility ?? 'everyone');
  const [error, setError] = useState<string | null>(null);

  const write = async (patch: { units?: Units; visibility?: Visibility }, rollback: () => void) => {
    setError(null);
    try {
      await updateProfile(patch);
      await refreshProfile();
    } catch {
      rollback();
      setError('Could not save — try again.');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Preferences</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>UNITS</Text>
          <Segmented
            options={[
              { value: 'km', label: 'KM' },
              { value: 'mi', label: 'MI' },
            ]}
            value={units}
            onChange={(v) => {
              const prev = units;
              setUnits(v);
              void write({ units: v }, () => setUnits(prev));
            }}
          />
        </View>

        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>PROFILE VISIBILITY</Text>
          {VISIBILITIES.map((v) => {
            const selected = visibility === v.value;
            return (
              <Pressable
                key={v.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => {
                  const prev = visibility;
                  setVisibility(v.value);
                  void write({ visibility: v.value }, () => setVisibility(prev));
                }}
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

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
    paddingHorizontal: spacing.sp3,
    paddingBottom: spacing.sp2,
  },
  content: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    gap: spacing.sp5,
  },
  section: { gap: spacing.sp3 },
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
  cardSelected: { borderColor: colors.ink900, borderWidth: borderWidth.bold },
  cardText: { flex: 1, gap: 2, paddingRight: spacing.sp3 },
  cardLabel: {
    fontFamily: fonts.display,
    fontSize: typeScale.tMd,
    color: colors.ink900,
  },
  error: { ...textStyles.caption, color: colors.danger },
});
