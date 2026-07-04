import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sizing, spacing, textStyles } from '@/theme/theme';

/** Your Runs — ALL / MANAGED / JOINED / PAST tabs land in Phase 2. */
export default function RunsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp4 }]}>
      <Text style={textStyles.screenTitle}>Your runs</Text>
      <Text style={textStyles.caption}>Managed & joined runs land in Phase 2.</Text>
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
});
