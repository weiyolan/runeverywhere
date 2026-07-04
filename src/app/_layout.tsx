import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/stores/session';
import { semantic } from '@/theme/theme';

export default function RootLayout() {
  const init = useSession((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
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
          <Stack.Screen name="dev/components" options={{ headerShown: true, title: 'Components' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
