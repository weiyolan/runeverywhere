import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, fonts, letterSpacing, sizing, spacing, textStyles, tracking, typeScale } from '@/theme/theme';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp12, paddingBottom: insets.bottom + spacing.sp6 }]}>
      {/* Root layout sets `dark`, illegible on the ink-900 hero */}
      <StatusBar style="light" />
      <View style={styles.hero}>
        <Text style={styles.badge}>SOCIAL RUNNING</Text>
        <Text style={styles.headline}>Run with anyone, anywhere</Text>
        <Text style={styles.sub}>
          Drop a start point, find people to run with, explore cities on foot.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Get started" full onPress={() => router.push('/(auth)/sign-up')} />
        <Button label="Log in" variant="volt-outline" full onPress={() => router.push('/(auth)/sign-in')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink900,
    paddingHorizontal: sizing.gutter,
    justifyContent: 'space-between',
  },
  hero: {
    gap: spacing.sp4,
  },
  badge: {
    ...textStyles.eyebrow,
    color: colors.volt,
  },
  headline: {
    fontFamily: fonts.displayBlack,
    fontSize: typeScale.dHero,
    lineHeight: typeScale.dHero * 1.02,
    color: colors.paper,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing(typeScale.dHero, tracking.tight),
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: typeScale.tLg,
    lineHeight: typeScale.tLg * 1.45,
    color: colors.ink300,
  },
  actions: {
    gap: spacing.sp3,
  },
});
