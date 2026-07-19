/**
 * RE Pro paywall (P6.5 D1 shell). Layout per the design; purchases wire up
 * with RevenueCat in M2 — until then the CTA is disabled behind the
 * monetization flag and prices are placeholder copy from the plan.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { ChartLine, Route, Star, X } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { FLAGS } from '@/lib/featureFlags';
import { LEGAL_URLS } from '@/lib/legal';
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

const FEATURES = [
  { icon: Route, label: 'Sync Strava & Garmin' },
  { icon: ChartLine, label: 'Full history & GPX export' },
  { icon: Star, label: 'Pro flair' },
] as const;

const PLANS = [
  { id: 'monthly', name: 'MONTHLY', price: '€4.99', per: '/month', best: false },
  { id: 'annual', name: 'ANNUAL', price: '€29.99', per: '/year', best: true },
] as const;

export default function PaywallScreen() {
  useLocalSearchParams<{ source?: string }>();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.sp4, paddingBottom: insets.bottom + spacing.sp8 },
      ]}
    >
      <View style={styles.closeRow}>
        <IconButton variant="ghost" accessibilityLabel="Close" onPress={() => router.back()}>
          <X size={22} color={colors.paper} />
        </IconButton>
      </View>

      <Text style={styles.hero}>GO PRO</Text>
      <Text style={styles.sub}>Everything in Run Everywhere, plus the power tools.</Text>

      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <f.icon size={20} color={colors.volt} />
            <Text style={styles.featureLabel}>{f.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.plans}>
        {PLANS.map((p) => {
          const selected = plan === p.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.planCard, selected && styles.planSelected]}
              onPress={() => setPlan(p.id)}
            >
              {p.best ? (
                <View style={styles.bestBadge}>
                  <Badge tone="volt" solid>
                    BEST VALUE −50%
                  </Badge>
                </View>
              ) : null}
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planPrice}>
                {p.price}
                <Text style={styles.planPer}>{p.per}</Text>
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        label={FLAGS.monetization ? 'START RE PRO' : 'COMING SOON'}
        full
        disabled={!FLAGS.monetization}
        onPress={() => {}}
      />
      <Button label="RESTORE PURCHASES" variant="ghost" full disabled={!FLAGS.monetization} onPress={() => {}} />

      <Text style={styles.disclosure}>
        Subscriptions auto-renew until cancelled and are billed by Apple/Google. Manage or cancel
        anytime in your store account settings.{' '}
        <Text style={styles.link} onPress={() => void Linking.openURL(LEGAL_URLS.terms)}>
          Terms
        </Text>{' '}
        ·{' '}
        <Text style={styles.link} onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}>
          Privacy
        </Text>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink900 },
  content: {
    paddingHorizontal: sizing.gutter,
    gap: spacing.sp4,
  },
  closeRow: { alignItems: 'flex-end' },
  hero: {
    fontFamily: fonts.displayBlack,
    fontSize: 56,
    lineHeight: 58,
    color: colors.paper,
    letterSpacing: letterSpacing(56, tracking.tight),
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: typeScale.tMd,
    lineHeight: typeScale.tMd * 1.45,
    color: colors.ink300,
    marginTop: -spacing.sp2,
  },
  features: { gap: spacing.sp3, marginVertical: spacing.sp2 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
  },
  featureLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: colors.paper,
  },
  plans: { flexDirection: 'row', gap: spacing.sp3 },
  planCard: {
    flex: 1,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink700,
    borderRadius: radius.md,
    padding: spacing.sp4,
    gap: spacing.sp1,
  },
  planSelected: { borderColor: colors.volt, borderWidth: borderWidth.bold },
  bestBadge: { position: 'absolute', top: -12, right: spacing.sp2 },
  planName: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.tXs,
    letterSpacing: letterSpacing(typeScale.tXs, tracking.label),
    color: colors.ink400,
  },
  planPrice: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d3,
    color: colors.paper,
  },
  planPer: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
    color: colors.ink400,
  },
  disclosure: {
    ...textStyles.caption,
    color: colors.ink500,
    textAlign: 'center',
  },
  link: { color: colors.ink300, textDecorationLine: 'underline' },
});
