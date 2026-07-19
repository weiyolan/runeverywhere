/** Notification prefs (P5 F5): five toggles, push-only gate; absent = on. */
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsRow, SettingsSection } from '@/components/settings/SettingsRow';
import { IconButton } from '@/components/ui/IconButton';
import { updateProfile } from '@/lib/profile';
import { useSession } from '@/stores/session';
import { colors, sizing, spacing, textStyles } from '@/theme/theme';

const TOGGLES: { key: string; label: string; subtitle: string }[] = [
  { key: 'requests', label: 'Join requests', subtitle: 'Requests and direct joins on your runs' },
  { key: 'accepts', label: 'Accepts & reminders', subtitle: 'Decisions on your requests, run reminders' },
  { key: 'messages', label: 'New messages', subtitle: 'Group chats and DMs' },
  { key: 'reviews', label: 'Reviews', subtitle: 'Rate-the-crew prompts and received reviews' },
  { key: 'rewards', label: 'Rewards & leaderboard', subtitle: 'Badges and your weekly ranking' },
];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    (profile?.notification_prefs as Record<string, boolean> | null) ?? {},
  );

  const toggle = (key: string, value: boolean) => {
    const prev = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    void updateProfile({ notification_prefs: next })
      .then(() => refreshProfile())
      .catch(() => setPrefs(prev));
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SettingsSection label="PUSH NOTIFICATIONS">
          {TOGGLES.map((t) => (
            <SettingsRow
              key={t.key}
              label={t.label}
              subtitle={t.subtitle}
              right={
                <Switch
                  value={prefs[t.key] ?? true}
                  onValueChange={(v) => toggle(t.key, v)}
                  trackColor={{ true: colors.volt, false: colors.ink200 }}
                  thumbColor={colors.paper}
                />
              }
            />
          ))}
        </SettingsSection>
        <Text style={textStyles.caption}>
          Controls push notifications. Your in-app inbox always keeps everything.
        </Text>
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
    gap: spacing.sp3,
  },
});
