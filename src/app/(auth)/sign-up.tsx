import { StyleSheet, Text, View } from 'react-native';

import { textStyles, sizing, spacing } from '@/theme/theme';

/** Phase 1: step 1/4 of onboarding — name, email, password, ToS. */
export default function SignUpScreen() {
  return (
    <View style={styles.screen}>
      <Text style={textStyles.screenTitle}>Create account</Text>
      <Text style={textStyles.caption}>Registration + 4-step onboarding land in Phase 1.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: sizing.gutter, paddingTop: 80, gap: spacing.sp3 },
});
