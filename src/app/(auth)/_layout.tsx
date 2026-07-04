import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/stores/session';

export default function AuthLayout() {
  const status = useSession((s) => s.status);

  if (status === 'signedIn') {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
