/**
 * Shared auth-screen chrome (P1 F): back button, screen title + subline,
 * keyboard-avoiding scroll body on paper2.
 */
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { colors, sizing, spacing, textStyles, typeScale } from '@/theme/theme';

export interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sp4, paddingBottom: insets.bottom + spacing.sp8 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <IconButton
          variant="surface"
          round
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'))}
        >
          <ArrowLeft size={20} />
        </IconButton>
        <View style={styles.heading}>
          <Text style={textStyles.screenTitle}>{title}</Text>
          <Text style={[textStyles.caption, { fontSize: typeScale.tMd }]}>{subtitle}</Text>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** "OR" hairline divider between email and provider auth. */
export function OrDivider() {
  return (
    <View style={styles.orRow}>
      <View style={styles.orLine} />
      <Text style={styles.orText}>OR</Text>
      <View style={styles.orLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.paper2,
  },
  content: {
    paddingHorizontal: sizing.gutter,
    gap: spacing.sp6,
  },
  heading: {
    gap: spacing.sp2,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.ink200,
  },
  orText: {
    ...textStyles.eyebrow,
    color: colors.ink400,
  },
});
