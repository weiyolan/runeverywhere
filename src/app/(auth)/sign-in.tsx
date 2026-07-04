import { StyleSheet, Text, View } from 'react-native';

import { textStyles, sizing, spacing } from '@/theme/theme';

/** Phase 1: email/password + Apple + Google via Supabase Auth. */
export default function SignInScreen() {
  return (
    <View style={styles.screen}>
      <Text style={textStyles.screenTitle}>Welcome back</Text>
      <Text style={textStyles.caption}>Sign-in lands in Phase 1 (Supabase Auth).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: sizing.gutter, paddingTop: 80, gap: spacing.sp3 },
});
