/**
 * Connected apps (P6 C2 shell). Rows render only for enabled flags; with all
 * flags off (current state — src/lib/featureFlags.ts) the screen shows the
 * empty state and settings/index never links here. OAuth/HealthKit wiring
 * lands with P6.1–P6.4.
 */
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { FLAGS } from '@/lib/featureFlags';
import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  radius,
  sizing,
  spacing,
  textStyles,
  tracking,
  typeScale,
} from '@/theme/theme';

interface Provider {
  key: string;
  name: string;
  sub: string;
  brand: string; // brand-accurate icon block color (P6 reconciliation)
  visible: boolean;
}

const PROVIDERS: Provider[] = [
  {
    key: 'strava',
    name: 'STRAVA',
    sub: 'Import runs, pace & segments',
    brand: '#FC4C02',
    visible: FLAGS.strava,
  },
  {
    key: 'healthkit',
    name: 'APPLE HEALTH',
    sub: 'Save your runs to Apple Health',
    brand: '#FF2D55',
    visible: FLAGS.healthkit && Platform.OS === 'ios',
  },
  {
    key: 'garmin',
    name: 'GARMIN',
    sub: 'Connect your watch',
    brand: '#007CC3',
    visible: FLAGS.garmin,
  },
];

export default function ConnectionsScreen() {
  const insets = useSafeAreaInsets();
  const visible = PROVIDERS.filter((p) => p.visible);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Connected apps</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {visible.length === 0 ? (
          <Text style={[textStyles.body, styles.empty]}>Nothing to connect yet.</Text>
        ) : (
          <View style={styles.card}>
            {visible.map((p) => (
              <View key={p.key} style={styles.row}>
                <View style={[styles.iconBlock, { backgroundColor: p.brand }]} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{p.name}</Text>
                  <Text style={styles.rowSub}>Not connected</Text>
                </View>
                <Button label="CONNECT" size="sm" variant="secondary" disabled onPress={() => {}} />
              </View>
            ))}
            <Text style={[textStyles.caption, styles.note]}>
              Connections arrive with the integrations launch.
            </Text>
          </View>
        )}
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
  },
  empty: { textAlign: 'center', paddingVertical: spacing.sp12 },
  card: {
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
    padding: spacing.sp4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink100,
  },
  iconBlock: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
  },
  rowText: { flex: 1, gap: 1 },
  rowName: {
    fontFamily: fonts.display,
    fontSize: typeScale.tMd,
    letterSpacing: letterSpacing(typeScale.tMd, tracking.caps),
    color: colors.ink900,
  },
  rowSub: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
    color: colors.ink400,
  },
  note: { padding: spacing.sp4 },
});
