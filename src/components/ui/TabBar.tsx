/**
 * TabBar — port of `project/components/navigation/TabBar.d.ts`.
 * Locked IA: Explore · Runs · [Create +] · Messages · Profile.
 * Exactly 4 tab items + the separate center Volt Create (+) button.
 */
import { Compass, MessageCircle, Plus, Route, User } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, semantic, shadows, sizing } from '@/theme/theme';

export type TabId = 'explore' | 'runs' | 'messages' | 'profile';

export interface TabBarProps {
  value: TabId;
  onChange: (tab: TabId) => void;
  onCreate: () => void;
  /** Unread indicator on the Messages tab. */
  messagesBadge?: boolean;
}

const TABS: { id: TabId; label: string; Icon: typeof Compass }[] = [
  { id: 'explore', label: 'EXPLORE', Icon: Compass },
  { id: 'runs', label: 'RUNS', Icon: Route },
  { id: 'messages', label: 'MESSAGES', Icon: MessageCircle },
  { id: 'profile', label: 'PROFILE', Icon: User },
];

export function TabBar({ value, onChange, onCreate, messagesBadge }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const renderTab = ({ id, label, Icon }: (typeof TABS)[number]) => {
    const active = value === id;
    return (
      <Pressable
        key={id}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => onChange(id)}
        style={styles.tab}
      >
        <View>
          <Icon size={24} color={active ? colors.volt : colors.ink400} strokeWidth={2.2} />
          {id === 'messages' && messagesBadge ? <View style={styles.badge} /> : null}
        </View>
        <Text style={[styles.tabLabel, { color: active ? colors.volt : colors.ink400 }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {left.map(renderTab)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create run"
        onPress={onCreate}
        style={({ pressed }) => [styles.create, shadows.volt, pressed && styles.createPressed]}
      >
        <Plus size={28} color={semantic.actionInk} strokeWidth={2.4} />
      </Pressable>
      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: semantic.bgInverse,
    minHeight: sizing.tabbarH,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    minHeight: sizing.touchMin,
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  create: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: semantic.action,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20, // floats above the bar
  },
  createPressed: {
    backgroundColor: semantic.actionPress,
    transform: [{ scale: 0.96 }],
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.volt,
  },
});

export default TabBar;
