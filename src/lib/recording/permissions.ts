/**
 * Recording permission escalation (P4 A4). Called from the START RUN handler,
 * never at app launch. Android needs no background permission — the
 * foreground service keeps the app "in use" (Play-policy-friendly posture).
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type RecordingPermission = 'granted' | 'foreground-only' | 'denied';

export async function ensureRecordingPermissions(): Promise<RecordingPermission> {
  let fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) {
    fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return 'denied';
  }
  if (Platform.OS === 'android') return 'granted';

  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.granted ? 'granted' : 'foreground-only';
}
