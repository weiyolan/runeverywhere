import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts, type FontSource } from 'expo-font';
import { Stack, router, usePathname, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import * as Notifications from 'expo-notifications';

import { Button } from '@/components/ui/Button';
import {
  ensureAndroidChannels,
  installNotificationHandler,
} from '@/lib/notifications';
import { consumePendingLink, savePendingLink } from '@/lib/pendingLink';
import { queryClient } from '@/lib/queryClient';
import '@/lib/queryFocus'; // wire TanStack focus to RN app state (P2 D5)
import { qk } from '@/lib/queryKeys';
import '@/lib/recording/locationTask'; // define the background task before any headless invocation (P4 E1)
import { getRecoveryState } from '@/lib/recording/recorder';
import { installWebShims } from '@/lib/webShims';
import { useSession } from '@/stores/session';
import { fonts, semantic, sizing, spacing, textStyles } from '@/theme/theme';

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
  const pathname = usePathname();

  const waiting =
    status === 'loading' ||
    (status === 'signedIn' && (profileStatus === 'idle' || profileStatus === 'loading'));

  useEffect(() => {
    if (waiting || profileStatus === 'error' || recovering) return;
    if (status === 'signedOut' && segment !== '(auth)') {
      // Keep the deep link (invite, run…) to replay after sign-in.
      if (pathname !== '/') void savePendingLink(pathname);
      router.replace('/(auth)/welcome');
    } else if (status === 'signedIn' && !profile?.onboarded_at && segment !== 'onboarding') {
      router.replace('/onboarding/profile');
    } else if (
      status === 'signedIn' &&
      profile?.onboarded_at &&
      (segment === '(auth)' || segment === 'onboarding')
    ) {
      void consumePendingLink().then((link) => router.replace((link ?? '/(tabs)') as never));
    }
    // pathname is only read at the moment of the signed-out redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

installWebShims();

// Native builds embed these via the expo-font config plugin; web must load them at runtime.
const webFonts: Record<string, FontSource> =
  Platform.OS === 'web'
    ? {
        [fonts.body]: require('../../assets/fonts/Saira-Regular.ttf'),
        [fonts.bodyMedium]: require('../../assets/fonts/Saira-Medium.ttf'),
        [fonts.bodySemiBold]: require('../../assets/fonts/Saira-SemiBold.ttf'),
        [fonts.bodyBold]: require('../../assets/fonts/Saira-Bold.ttf'),
        [fonts.displayMedium]: require('../../assets/fonts/SairaCondensed-Medium.ttf'),
        [fonts.displaySemiBold]: require('../../assets/fonts/SairaCondensed-SemiBold.ttf'),
        [fonts.display]: require('../../assets/fonts/SairaCondensed-Bold.ttf'),
        [fonts.displayExtra]: require('../../assets/fonts/SairaCondensed-ExtraBold.ttf'),
        [fonts.displayBlack]: require('../../assets/fonts/SairaCondensed-Black.ttf'),
      }
    : {};

export default function RootLayout() {
  const init = useSession((s) => s.init);
  const [fontsLoaded] = useFonts(webFonts);

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
    if (Platform.OS !== 'web') {
      void Notifications.getLastNotificationResponseAsync().then(openFromResponse); // cold start
    }

    return () => {
      received.remove();
      responded.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

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
              <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
              <Stack.Screen name="explore/search" />
              <Stack.Screen name="explore/filters" options={{ presentation: 'modal' }} />
              <Stack.Screen name="run/[id]" />
              <Stack.Screen name="chat/[conversationId]" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="live/[runId]" options={{ gestureEnabled: false }} />
              <Stack.Screen name="recap/[trackId]" options={{ gestureEnabled: false }} />
              <Stack.Screen name="review/[runId]" />
              <Stack.Screen name="user/[id]" />
              <Stack.Screen name="rewards" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="invite/[code]" />
              <Stack.Screen name="dev/components" options={{ headerShown: true, title: 'Components' }} />
            </Stack>
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
