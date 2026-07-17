import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/queryClient';
import '@/lib/queryFocus'; // wire TanStack focus to RN app state (P2 D5)
import { useSession } from '@/stores/session';
import { semantic } from '@/theme/theme';

export default function RootLayout() {
  const init = useSession((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: semantic.bgApp },
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="create" options={{ presentation: 'modal' }} />
            <Stack.Screen name="explore/search" />
            <Stack.Screen name="explore/filters" options={{ presentation: 'modal' }} />
            <Stack.Screen name="run/[id]" />
            <Stack.Screen name="invite/[code]" />
            <Stack.Screen name="dev/components" options={{ headerShown: true, title: 'Components' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
