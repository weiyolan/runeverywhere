/**
 * Shared onboarding step chrome (P1 H): header + title/sub + scroll body +
 * sticky CONTINUE footer with working/error states. Every step persists on
 * CONTINUE (write-through — no draft store, P1 decision 12).
 */
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { Button } from '@/components/ui/Button';
import { colors, sizing, spacing, textStyles, typeScale } from '@/theme/theme';

export interface StepShellProps {
  step: 1 | 2 | 3 | 4;
  onBack?: () => void;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaDisabled?: boolean;
  working?: boolean;
  error?: string | null;
  onContinue: () => void;
  children: React.ReactNode;
}

export function StepShell({
  step,
  onBack,
  title,
  subtitle,
  ctaLabel = 'CONTINUE',
  ctaDisabled = false,
  working = false,
  error,
  onContinue,
  children,
}: StepShellProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sp4 }]}>
        <View style={styles.gutter}>
          <OnboardingHeader step={step} onBack={onBack} />
        </View>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heading}>
            <Text style={textStyles.screenTitle}>{title}</Text>
            {subtitle ? (
              <Text style={[textStyles.caption, { fontSize: typeScale.tMd }]}>{subtitle}</Text>
            ) : null}
          </View>
          {children}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sp4 }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={working ? 'SAVING…' : ctaLabel}
            full
            disabled={ctaDisabled || working}
            onPress={onContinue}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.paper2,
  },
  gutter: {
    paddingHorizontal: sizing.gutter,
  },
  content: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp6,
    paddingBottom: spacing.sp8,
    gap: spacing.sp6,
  },
  heading: {
    gap: spacing.sp2,
  },
  footer: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    gap: spacing.sp2,
  },
  error: {
    ...textStyles.caption,
    color: colors.danger,
  },
});
