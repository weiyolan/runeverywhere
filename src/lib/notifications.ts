/**
 * Push registration + Android channels + foreground handling (P3 E3/E4).
 * Prompt timing is contextual (after first join / first publish / opt-in card
 * on /notifications) — never at app launch.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/stores/chat';

export async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('requests', {
    name: 'Join requests',
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Run reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Foreground suppression: the visible chat swallows its own banners. */
export function installNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: (notification) => {
      const data = notification.request.content.data as
        | { conversationId?: string }
        | undefined;
      const suppress =
        data?.conversationId != null &&
        data.conversationId === useChatStore.getState().activeConversationId;
      return Promise.resolve({
        shouldShowBanner: !suppress,
        shouldShowList: !suppress,
        shouldPlaySound: !suppress,
        shouldSetBadge: false,
      });
    },
  });
}

/** Register this device for push; returns false when unavailable/denied. */
export async function registerForPush(): Promise<boolean> {
  if (!Device.isDevice) return false;
  let perm = await Notifications.getPermissionsAsync();
  if (perm.status === 'undetermined') {
    perm = await Notifications.requestPermissionsAsync();
  }
  if (perm.status !== 'granted') return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    throw new Error('extra.eas.projectId missing — run `eas init` (P0 precondition)');
  }
  const { data: tokenRes } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return false;
  const { error } = await supabase.from('push_tokens').upsert({
    token: tokenRes,
    user_id: uid,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return true;
}

/** Delete this device's token row — wired into sign-out. */
export async function unregisterPush() {
  if (!Device.isDevice) return;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;
    const { data: tokenRes } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('token', tokenRes);
  } catch {
    // Best-effort — sign-out must never fail on push cleanup.
  }
}
