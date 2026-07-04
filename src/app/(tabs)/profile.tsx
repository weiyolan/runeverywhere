import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useSession } from '@/stores/session';
import { colors, sizing, spacing, textStyles } from '@/theme/theme';

/** Profile — stats, level ring, badges, reviews land in Phase 5. */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const signOut = useSession((s) => s.signOut);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp4 }]}>
      <Text style={textStyles.screenTitle}>Profile</Text>
      <Text style={textStyles.caption}>Stats, badges & reviews land in Phase 5.</Text>
      <View style={styles.footer}>
        <Button label="Log out" variant="ghost" size="sm" onPress={signOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper2,
    paddingHorizontal: sizing.gutter,
    gap: spacing.sp3,
  },
  footer: { marginTop: spacing.sp8, alignItems: 'flex-start' },
});
