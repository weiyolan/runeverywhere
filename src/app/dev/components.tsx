import { Search, Share2, SlidersHorizontal, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MapPin } from '@/components/map/MapPin';
import { RouteMarker } from '@/components/map/RouteMarker';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { RunCard } from '@/components/ui/RunCard';
import { StatBlock } from '@/components/ui/StatBlock';
import { TabBar } from '@/components/ui/TabBar';
import { Tabs } from '@/components/ui/Tabs';
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
  const [tab, setTab] = useState('all');
  const [pill, setPill] = useState('map');
  const [inputValue, setInputValue] = useState('');
  const [goal, setGoal] = useState('');

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

      <Text style={textStyles.sectionHeader}>Inputs</Text>
      <View style={styles.group}>
        <Input label="Run name" value={inputValue} onChangeText={setInputValue} placeholder="Old Town Loop" maxLength={40} />
        <Input label="Goal" value={goal} onChangeText={setGoal} multiline placeholder="What's this run about?" hint={goal.length + '/200'} maxLength={200} />
        <Input label="Invalid" value="way too fast" onChangeText={() => {}} invalid hint="Pace between 2:00 and 12:00 /km" />
        <Input label="Disabled" value="Lisbon" onChangeText={() => {}} disabled />
        <Input label="Search" value={inputValue} onChangeText={setInputValue} placeholder="Search runs, areas, runners" leading={<Search size={18} color={colors.ink400} />} trailing={<X size={18} color={colors.ink400} />} />
      </View>

      <Text style={textStyles.sectionHeader}>Icon buttons</Text>
      <View style={[styles.group, styles.row]}>
        <IconButton accessibilityLabel="Filters"><SlidersHorizontal size={20} /></IconButton>
        <IconButton variant="ink" accessibilityLabel="Share"><Share2 size={20} /></IconButton>
        <IconButton variant="volt" accessibilityLabel="Search"><Search size={20} /></IconButton>
        <IconButton variant="ghost" accessibilityLabel="Close"><X size={20} /></IconButton>
        <IconButton variant="danger" accessibilityLabel="Remove"><X size={20} /></IconButton>
        <IconButton round accessibilityLabel="Round"><Search size={20} /></IconButton>
        <IconButton active accessibilityLabel="Active"><SlidersHorizontal size={20} /></IconButton>
        <IconButton size="sm" accessibilityLabel="Small"><X size={16} /></IconButton>
        <IconButton size="lg" accessibilityLabel="Large"><Search size={24} /></IconButton>
        <IconButton disabled accessibilityLabel="Disabled"><X size={20} /></IconButton>
      </View>

      <Text style={textStyles.sectionHeader}>Tabs</Text>
      <View style={styles.group}>
        <Tabs
          items={[
            { id: 'all', label: 'All' },
            { id: 'managed', label: 'Managed by you', count: 2 },
            { id: 'joined', label: 'Joined', count: 3 },
          ]}
          value={tab}
          onChange={setTab}
        />
        <Tabs
          variant="pill"
          items={[
            { id: 'map', label: 'Map' },
            { id: 'list', label: 'List' },
          ]}
          value={pill}
          onChange={setPill}
        />
      </View>

      <Text style={textStyles.sectionHeader}>Badges</Text>
      <View style={[styles.group, styles.row]}>
        <Badge>Neutral</Badge>
        <Badge tone="ink">Invite only</Badge>
        <Badge tone="volt">+120 PTS</Badge>
        <Badge tone="go">Open</Badge>
        <Badge tone="warn">4 spots left</Badge>
        <Badge tone="danger">Cancelled</Badge>
        <Badge tone="star">4.9</Badge>
        <Badge tone="go" solid>Live</Badge>
        <Badge tone="warn" solid>Pending</Badge>
        <Badge tone="danger" solid>Full</Badge>
        <Badge tone="volt" solid>+220 PTS</Badge>
      </View>

      <Text style={textStyles.sectionHeader}>Avatars</Text>
      <View style={[styles.group, styles.row, styles.rowEnd]}>
        <Avatar name="Maya Lawson" size="xs" />
        <Avatar name="Marco R." size="sm" />
        <Avatar name="Nadia K." size="md" verified />
        <Avatar name="Rui Costa" size="lg" ring={colors.volt} />
        <Avatar name="Ana Silva" size="xl" ring={colors.go} verified />
      </View>

      <Text style={textStyles.sectionHeader}>Stat blocks</Text>
      <View style={[styles.group, styles.row, styles.spaceBetween]}>
        <StatBlock value="7.5" unit="km" label="Distance" size="sm" />
        <StatBlock value="5:30" unit="/km" label="Pace" />
        <StatBlock value="Sat" label="Day" />
        <StatBlock value="08:00" label="Time" accent={colors.discover} size="lg" />
      </View>

      <Text style={textStyles.sectionHeader}>Map pins</Text>
      <View style={[styles.group, styles.row, styles.rowEnd, styles.mapCanvas]}>
        <MapPin type="discover" label="7.5K" />
        <MapPin type="challenge" label="12K" />
        <MapPin type="social" label="5K" />
        <MapPin type="challenge" label="10K" selected />
        <MapPin cluster label="7" />
      </View>

      <Text style={textStyles.sectionHeader}>Route markers</Text>
      <View style={[styles.group, styles.row, styles.rowEnd, styles.mapCanvas]}>
        <RouteMarker kind="start" type="discover" />
        <RouteMarker kind="start" type="social" size={30} />
        <RouteMarker kind="finish" type="challenge" size={30} />
        <RouteMarker kind="closed" type="discover" size={30} />
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
  rowEnd: { alignItems: 'flex-end' },
  spaceBetween: { justifyContent: 'space-between' },
  darkPanel: { backgroundColor: colors.ink900, padding: spacing.sp3, borderRadius: 12 },
  mapCanvas: { backgroundColor: colors.paper3, borderRadius: radius.md, padding: spacing.sp4 },
  /* TabBar styles its own ink background; let it span the screen width. */
  fullBleed: { marginHorizontal: -sizing.gutter },
  swatch: { alignItems: 'center', gap: 2 },
  swatchSquare: { width: 24, height: 24, borderRadius: radius.xs },
});
