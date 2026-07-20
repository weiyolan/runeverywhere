import { Stack } from 'expo-router';

/** Routing lives in the root AuthGate (P1 E3) — this layout only renders. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
