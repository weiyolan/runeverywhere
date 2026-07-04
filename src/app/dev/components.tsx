import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { RunCard } from '@/components/ui/RunCard';
import { TypeChip } from '@/components/ui/TypeChip';
import { colors, sizing, spacing, textStyles } from '@/theme/theme';

/** Dev-only gallery proving the design-system port. Not linked in production UI. */
export default function ComponentGallery() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={textStyles.sectionHeader}>Buttons</Text>
      <View style={styles.group}>
        <Button label="Publish run" onPress={() => {}} />
        <Button label="Request to join" variant="secondary" onPress={() => {}} />
        <Button label="Save run" variant="ghost" onPress={() => {}} />
        <Button label="Cancel run" variant="danger" onPress={() => {}} />
        <View style={styles.darkPanel}>
          <Button label="Start run" variant="volt-outline" onPress={() => {}} />
        </View>
        <Button label="Disabled" disabled onPress={() => {}} />
      </View>

      <Text style={textStyles.sectionHeader}>Type chips</Text>
      <View style={[styles.group, styles.row]}>
        <TypeChip type="discover" />
        <TypeChip type="challenge" />
        <TypeChip type="social" />
        <TypeChip type="discover" chipStyle="soft" />
        <TypeChip type="challenge" chipStyle="soft" />
        <TypeChip type="social" chipStyle="soft" />
      </View>

      <Text style={textStyles.sectionHeader}>Run card</Text>
      <View style={styles.group}>
        <RunCard
          type="discover"
          title="Old Town Loop"
          goal="Training for an ultra, easy effort to see the old town."
          host={{ name: 'Marco R.', rating: 4.9 }}
          distance="7.5 km"
          pace="6:00 /km"
          when="Sat · 08:00"
          city="Alfama · Lisbon"
          spotsLeft={3}
        />
        <RunCard
          type="challenge"
          title="Monsanto Hills"
          host={{ name: 'Sofia K.', rating: 4.8 }}
          distance="12 km"
          pace="4:30 /km"
          when="Sun · 07:30"
          spotsLeft={0}
          variant="compact"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  content: { padding: sizing.gutter, gap: spacing.sp4, paddingBottom: spacing.sp16 },
  group: { gap: spacing.sp3 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  darkPanel: { backgroundColor: colors.ink900, padding: spacing.sp3, borderRadius: 12 },
});
