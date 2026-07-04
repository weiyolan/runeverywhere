import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TypeChip } from '@/components/ui/TypeChip';
import { colors, sizing, spacing, textStyles } from '@/theme/theme';

/** Step 1/4 — pick a run type. Full wizard lands in Phase 2. */
export default function CreateTypeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={textStyles.eyebrow}>STEP 1 / 4</Text>
      <Text style={textStyles.screenTitle}>What kind of run?</Text>

      <View style={styles.types}>
        <TypeChip type="discover" />
        <TypeChip type="challenge" />
        <TypeChip type="social" />
      </View>
      <Text style={textStyles.caption}>The 4-step create wizard lands in Phase 2.</Text>

      <View style={styles.footer}>
        <Button label="Close" variant="secondary" full onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper2,
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp8,
    gap: spacing.sp3,
  },
  types: { flexDirection: 'row', gap: spacing.sp2, marginVertical: spacing.sp4 },
  footer: { marginTop: 'auto', paddingBottom: spacing.sp8 },
});
