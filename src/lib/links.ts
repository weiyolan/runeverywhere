import { createURL } from 'expo-linking';
import { Platform } from 'react-native';

/**
 * The one public URL for an in-app path: https://<web>/invite/<code> opens the
 * web app for everyone, and the native app once Universal/App Links are set
 * up (associatedDomains + .well-known files — needs store accounts).
 * Native without EXPO_PUBLIC_WEB_URL (dev) falls back to the scheme link.
 */
export function webUrl(path: string) {
  if (Platform.OS === 'web') return `${window.location.origin}${path}`;
  const base = process.env.EXPO_PUBLIC_WEB_URL;
  return base ? `${base.replace(/\/$/, '')}${path}` : createURL(path);
}
