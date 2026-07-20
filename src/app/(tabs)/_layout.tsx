import { Tabs, router } from 'expo-router';

import { TabBar, type TabId } from '@/components/ui/TabBar';
import { useUnreadBadges } from '@/hooks/useUnreadBadges';

/** Maps router route names to the design's four tab ids. */
const ROUTE_TO_TAB: Record<string, TabId> = {
  index: 'explore',
  runs: 'runs',
  messages: 'messages',
  profile: 'profile',
};

/** Routing lives in the root AuthGate (P1 E3) — this layout only renders. */
export default function TabsLayout() {
  const { messagesUnread } = useUnreadBadges();

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => {
        const routeName = state.routes[state.index]?.name ?? 'index';
        return (
          <TabBar
            messagesBadge={messagesUnread}
            value={ROUTE_TO_TAB[routeName] ?? 'explore'}
            onChange={(tab) => {
              const target = Object.entries(ROUTE_TO_TAB).find(([, id]) => id === tab)?.[0];
              if (target) navigation.navigate(target as never);
            }}
            onCreate={() => router.push('/create/type')}
          />
        );
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="runs" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
