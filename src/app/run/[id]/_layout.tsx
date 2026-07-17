import { Stack } from 'expo-router';

/** Run detail cluster (P2 H1): index, request (modal), requests, manage, roster. */
export default function RunLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="request" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
