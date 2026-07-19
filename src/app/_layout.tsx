import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { queryClient } from '@/lib/queryClient';
import '@/lib/queryFocus'; // wire TanStack focus to RN app state (P2 D5)
import { useSession } from '@/stores/session';
import { semantic, sizing, spacing, textStyles } from '@/theme/theme';

/**
 * Centralized auth-state routing (P1 E3). Rules are exhaustive and mutually
 * exclusive; `profileStatus` 'idle' suppresses rendering exactly like
 * 'loading' so the guard never observes a signed-in user with an unfetched
 * profile (which would misroute onboarded users into onboarding).
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useSession((s) => s.status);
  const profile = useSession((s) => s.profile);
  const profileStatus = useSession((s) => s.profileStatus);
  const recovering = useSession((s) => s.recovering);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const segments = useSegments();
  const segment = segments[0];

  const waiting =
    status === 'loading' ||
    (status === 'signedIn' && (profileStatus === 'idle' || profileStatus === 'loading'));

  useEffect(() => {
    if (waiting || profileStatus === 'error' || recovering) return;
    if (status === 'signedOut' && segment !== '(auth)') {
      router.replace('/(auth)/welcome');
    } else if (status === 'signedIn' && !profile?.onboarded_at && segment !== 'onboarding') {
      router.replace('/onboarding/profile');
    } else if (
      status === 'signedIn' &&
      profile?.onboarded_at &&
      (segment === '(auth)' || segment === 'onboarding')
    ) {
      router.replace('/(tabs)');
    }
  }, [waiting, profileStatus, recovering, status, profile?.onboarded_at, segment]);

  if (waiting) return null;

  if (status === 'signedIn' && profileStatus === 'error') {
    return (
      <View style={gateStyles.error}>
        <Text style={textStyles.body}>Could not load your profile.</Text>
        <Button label="RETRY" onPress={() => void refreshProfile()} />
      </View>
    );
  }

  return <>{children}</>;
}

const gateStyles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sp4,
    paddingHorizontal: sizing.gutter,
    backgroundColor: semantic.bgApp,
  },
});

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
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: semantic.bgApp },
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="create" options={{ presentation: 'modal' }} />
              <Stack.Screen name="explore/search" />
              <Stack.Screen name="explore/filters" options={{ presentation: 'modal' }} />
              <Stack.Screen name="run/[id]" />
              <Stack.Screen name="invite/[code]" />
              <Stack.Screen name="dev/components" options={{ headerShown: true, title: 'Components' }} />
            </Stack>
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
