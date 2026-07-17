import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { RunCard } from '@/components/ui/RunCard';
import { TabBar } from '@/components/ui/TabBar';
import { TypeChip } from '@/components/ui/TypeChip';
import { colors, radius, sizing, spacing, textStyles } from '@/theme/theme';

const SWATCHES = [
  colors.volt,
  colors.discover,
  colors.challenge,
  colors.social,
  colors.go,
  colors.warn,
  colors.danger,
  colors.star,
] as const;

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
        <TypeChip type="discover" custom="ROUTE" />
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
        <RunCard
          type="social"
          title="Sunset 5K"
          goal="Easy effort, coffee after."
          host={{ name: 'João L.', rating: 4.9, verified: true }}
          distance="5.2 km"
          pace="6:30 /km"
          when="Today · 18:30"
          city="Belém · Lisbon"
          spotsLeft={3}
          spotsTotal={8}
          closedLoop
          attendees={[
            { name: 'Maya Lawson' },
            { name: 'Rui Costa' },
            { name: 'Ana Silva' },
            { name: 'Tom Baker' },
          ]}
          variant="feature"
        />
      </View>

      <Text style={textStyles.sectionHeader}>Tab bar</Text>
      <View style={styles.fullBleed}>
        <TabBar value="explore" onChange={() => {}} onCreate={() => {}} messagesBadge />
      </View>

      <Text style={textStyles.sectionHeader}>Type & color</Text>
      <View style={styles.group}>
        <Text style={textStyles.screenTitle}>Screen title</Text>
        <Text style={textStyles.sectionHeader}>Section header</Text>
        <Text style={textStyles.cardTitle}>Card title</Text>
        <Text style={textStyles.eyebrow}>Eyebrow label</Text>
        <Text style={textStyles.body}>Body — Saira renders this paragraph face.</Text>
        <Text style={textStyles.caption}>Caption — secondary detail text.</Text>
        <Text style={textStyles.metric}>5:30</Text>
        <View style={styles.row}>
          {SWATCHES.map((hex) => (
            <View key={hex} style={styles.swatch}>
              <View style={[styles.swatchSquare, { backgroundColor: hex }]} />
              <Text style={textStyles.caption}>{hex}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  content: { padding: sizing.gutter, gap: spacing.sp4, paddingBottom: spacing.sp16 },
  group: { gap: spacing.sp3 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sp2 },
  darkPanel: { backgroundColor: colors.ink900, padding: spacing.sp3, borderRadius: 12 },
  /* TabBar styles its own ink background; let it span the screen width. */
  fullBleed: { marginHorizontal: -sizing.gutter },
  swatch: { alignItems: 'center', gap: 2 },
  swatchSquare: { width: 24, height: 24, borderRadius: radius.xs },
});
