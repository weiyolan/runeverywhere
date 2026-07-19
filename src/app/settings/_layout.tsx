import { Stack } from 'expo-router';

import { colors } from '@/theme/theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper2 } }}
    />
  );
}
