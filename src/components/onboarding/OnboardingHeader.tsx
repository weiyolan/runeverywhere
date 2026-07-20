/**
 * Onboarding header (P1 D3) — optional back button, volt progress bar,
 * "STEP n/4" label, per the auth flow HTML.
 */
import { ArrowLeft } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { colors, fonts, letterSpacing, radius, spacing, tracking, typeScale } from '@/theme/theme';

export interface OnboardingHeaderProps {
  step: 1 | 2 | 3 | 4;
  onBack?: () => void;
}

export function OnboardingHeader({ step, onBack }: OnboardingHeaderProps) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <IconButton variant="surface" round size="sm" accessibilityLabel="Back" onPress={onBack}>
          <ArrowLeft size={18} />
        </IconButton>
      ) : (
        <View style={styles.backSpacer} />
      )}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${step * 25}%` }]} />
      </View>
      <Text style={styles.step}>STEP {step}/4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp4,
  },
  backSpacer: { width: 36 },
  track: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.ink100,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.volt,
  },
  step: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tXs,
    letterSpacing: letterSpacing(typeScale.tXs, tracking.label),
    color: colors.ink400,
  },
});
