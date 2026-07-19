/** Settings hub (P5 F2). "Connected apps" is omitted until P6. */
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsRow, SettingsSection } from '@/components/settings/SettingsRow';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { FLAGS } from '@/lib/featureFlags';
import { qk } from '@/lib/queryKeys';
import { listBlocked } from '@/lib/safety';
import { useSession } from '@/stores/session';
import { colors, sizing, spacing, textStyles } from '@/theme/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const signOut = useSession((s) => s.signOut);

  const blocked = useQuery({ queryKey: qk.blockedList(), queryFn: listBlocked }).data;

  // P6 C4: section renders only when a platform-visible integration flag is
  // on — Android with only healthkit enabled must not link to a zero-row
  // screen. All flags are currently off (src/lib/featureFlags.ts).
  const integrationsVisible =
    FLAGS.strava || FLAGS.garmin || (Platform.OS === 'ios' && FLAGS.healthkit);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.sp10 }]}>
        <SettingsSection label="ACCOUNT">
          <SettingsRow label="Edit profile" onPress={() => router.push('/settings/edit-profile')} />
          <SettingsRow
            label="Account & security"
            subtitle={session?.user.email ?? undefined}
            onPress={() => router.push('/settings/account')}
          />
        </SettingsSection>

        {integrationsVisible ? (
          <SettingsSection label="CONNECTED APPS">
            <SettingsRow
              label="Connected apps"
              subtitle="Not connected"
              onPress={() => router.push('/settings/connections')}
            />
          </SettingsSection>
        ) : null}

        <SettingsSection label="PREFERENCES">
          <SettingsRow label="Preferences" onPress={() => router.push('/settings/preferences')} />
          <SettingsRow label="Notifications" onPress={() => router.push('/settings/notifications')} />
        </SettingsSection>

        <SettingsSection label="SAFETY & PRIVACY">
          <SettingsRow
            label="Safety & live location"
            subtitle="Trusted contacts, share runs"
            onPress={() => router.push('/settings/safety')}
          />
          <SettingsRow
            label="Blocked accounts"
            right={blocked && blocked.length > 0 ? <Badge>{blocked.length}</Badge> : undefined}
            onPress={() => router.push('/settings/blocked')}
          />
        </SettingsSection>

        <SettingsSection label="LEGAL">
          <SettingsRow label="Terms & privacy" onPress={() => router.push('/settings/legal')} />
        </SettingsSection>

        <SettingsSection label=" ">
          <SettingsRow label="Log out" danger onPress={() => void signOut()} />
        </SettingsSection>

        <Text style={styles.version}>
          Run Everywhere · v{Constants.expoConfig?.version ?? '0.0.0'}
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
    paddingTop: spacing.sp2,
    gap: spacing.sp5,
  },
  version: {
    ...textStyles.caption,
    textAlign: 'center',
    color: colors.ink400,
  },
});
