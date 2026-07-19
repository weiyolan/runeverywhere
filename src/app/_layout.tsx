import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import * as Notifications from 'expo-notifications';

import { Button } from '@/components/ui/Button';
import {
  ensureAndroidChannels,
  installNotificationHandler,
} from '@/lib/notifications';
import { queryClient } from '@/lib/queryClient';
import '@/lib/queryFocus'; // wire TanStack focus to RN app state (P2 D5)
import { qk } from '@/lib/queryKeys';
import '@/lib/recording/locationTask'; // define the background task before any headless invocation (P4 E1)
import { getRecoveryState } from '@/lib/recording/recorder';
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

  // Crash recovery (P4 E6): a live task resumes, a dead one offers salvage.
  useEffect(() => {
    void getRecoveryState().then((rec) => {
      if (rec.kind === 'resume-live') router.replace(`/live/${rec.runId}`);
      else if (rec.kind === 'salvage') router.replace(`/live/${rec.runId}?salvage=1`);
    });
  }, []);

  // Push plumbing (P3 E4): channels, foreground suppression, tap navigation.
  useEffect(() => {
    installNotificationHandler();
    void ensureAndroidChannels();

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: qk.conversations() });
      void queryClient.invalidateQueries({ queryKey: qk.notifications() });
    };
    const received = Notifications.addNotificationReceivedListener(invalidate);

    const openFromResponse = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    };
    const responded = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    void Notifications.getLastNotificationResponseAsync().then(openFromResponse); // cold start

    return () => {
      received.remove();
      responded.remove();
    };
  }, []);

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
              <Stack.Screen name="chat/[conversationId]" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="live/[runId]" options={{ gestureEnabled: false }} />
              <Stack.Screen name="recap/[trackId]" options={{ gestureEnabled: false }} />
              <Stack.Screen name="review/[runId]" />
              <Stack.Screen name="invite/[code]" />
              <Stack.Screen name="dev/components" options={{ headerShown: true, title: 'Components' }} />
            </Stack>
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
