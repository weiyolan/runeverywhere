import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RunCard } from '@/components/ui/RunCard';
import { colors, sizing, spacing, textStyles } from '@/theme/theme';

/**
 * Explore — Phase 2 replaces the fixture list with the real map
 * (react-native-maps + typed pins + clustering) and `runs_within_radius`.
 */
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sp4 }]}
    >
      <Text style={textStyles.eyebrow}>YOU’RE IN LISBON</Text>
      <Text style={textStyles.screenTitle}>Runs near you</Text>

      <View style={styles.list}>
        <RunCard
          type="discover"
          title="Old Town Loop"
          goal="Training for an ultra, easy effort to see the old town."
          host={{ name: 'Marco R.', rating: 4.9 }}
          distance="7.5 km"
          pace="6:00 /km"
          when="Sat · 08:00"
          city="Alfama · Lisbon"
          spotsLeft={3}
        />
        <RunCard
          type="challenge"
          title="Monsanto Hills"
          goal="Hard tempo on the climbs — bring your legs."
          host={{ name: 'Sofia K.', rating: 4.8 }}
          distance="12 km"
          pace="4:30 /km"
          when="Sun · 07:30"
          city="Monsanto · Lisbon"
          spotsLeft={0}
        />
        <RunCard
          type="social"
          title="Sunset 5K"
          goal="Easy effort, coffee after."
          host={{ name: 'João L.', rating: 4.9 }}
          distance="5.2 km"
          pace="6:30 /km"
          when="Today · 18:30"
          city="Belém · Lisbon"
          spotsLeft={4}
        />
      </View>

      {__DEV__ ? (
        <Link href="/dev/components" style={styles.devLink}>
          <Text style={textStyles.caption}>Open component gallery →</Text>
        </Link>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  content: { paddingHorizontal: sizing.gutter, paddingBottom: spacing.sp12, gap: spacing.sp2 },
  list: { gap: spacing.sp3, marginTop: spacing.sp4 },
  devLink: { marginTop: spacing.sp6, alignSelf: 'center' },
});
