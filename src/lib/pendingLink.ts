import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A deep link opened while signed out (P7 B1): AuthGate saves it before
 * bouncing to welcome and replays it once the user is signed in + onboarded.
 * Persisted so it survives the email-confirm round trip / a closed tab.
 */
const KEY = 'pendingLink';
const TTL_MS = 30 * 60 * 1000;

export async function savePendingLink(path: string, now = Date.now()) {
  await AsyncStorage.setItem(KEY, JSON.stringify({ path, at: now }));
}

export async function consumePendingLink(now = Date.now()): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw == null) return null;
  await AsyncStorage.removeItem(KEY);
  try {
    const { path, at } = JSON.parse(raw) as { path: string; at: number };
    return now - at <= TTL_MS && path.startsWith('/') ? path : null;
  } catch {
    return null;
  }
}
