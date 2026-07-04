import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sizing, spacing, textStyles } from '@/theme/theme';

/** Messages — run group chats + DMs over Supabase Realtime land in Phase 3. */
export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp4 }]}>
      <Text style={textStyles.screenTitle}>Messages</Text>
      <Text style={textStyles.caption}>Group chats & DMs land in Phase 3.</Text>
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
