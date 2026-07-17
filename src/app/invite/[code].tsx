/**
 * Invite deep link (P2 I4): runeverywhere://invite/<code> → resolve via
 * get_run_by_invite → run detail with instant JOIN. Migration …22 guarantees
 * the code never contains a path-splitting character.
 */
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { qk } from '@/lib/queryKeys';
import { fetchRunByInvite } from '@/lib/runs';
import { colors, sizing, spacing, textStyles } from '@/theme/theme';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();

  const query = useQuery({
    queryKey: qk.invite(code),
    queryFn: () => fetchRunByInvite(code),
    retry: 1,
  });

  useEffect(() => {
    if (query.data) {
      router.replace(`/run/${query.data.id}?code=${code}`);
    }
  }, [query.data, code]);

  if (query.isLoading || query.data) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={colors.ink900} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={[textStyles.body, styles.message]}>
        This invite link is invalid or the run is no longer live.
      </Text>
      <Button label="Explore runs" onPress={() => router.replace('/(tabs)')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sp4,
    paddingHorizontal: sizing.gutter,
  },
  message: { textAlign: 'center' },
});
