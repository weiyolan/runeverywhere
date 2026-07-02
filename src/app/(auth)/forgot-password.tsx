import { StyleSheet, Text, View } from 'react-native';

import { textStyles, sizing, spacing } from '@/theme/theme';

/** Phase 1: Supabase Auth password reset via email deep link. */
export default function ForgotPasswordScreen() {
  return (
    <View style={styles.screen}>
      <Text style={textStyles.screenTitle}>Reset password</Text>
      <Text style={textStyles.caption}>Password reset lands in Phase 1.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: sizing.gutter, paddingTop: 80, gap: spacing.sp3 },
});
