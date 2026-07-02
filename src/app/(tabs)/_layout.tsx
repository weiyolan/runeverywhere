import { Redirect, Tabs, router } from 'expo-router';

import { TabBar, type TabId } from '@/components/ui/TabBar';
import { useSession } from '@/stores/session';

/** Maps router route names to the design's four tab ids. */
const ROUTE_TO_TAB: Record<string, TabId> = {
  index: 'explore',
  runs: 'runs',
  messages: 'messages',
  profile: 'profile',
};

export default function TabsLayout() {
  const status = useSession((s) => s.status);

  if (status === 'loading') {
    return null; // splash screen stays up until the session resolves
  }
  if (status === 'signedOut') {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => {
        const routeName = state.routes[state.index]?.name ?? 'index';
        return (
          <TabBar
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
