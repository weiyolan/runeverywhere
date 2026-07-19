/** Blocked accounts (P5 F6). */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { qk } from '@/lib/queryKeys';
import { listBlocked, unblock } from '@/lib/safety';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  sizing,
  spacing,
  textStyles,
  typeScale,
} from '@/theme/theme';

export default function BlockedScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: qk.blockedList(), queryFn: listBlocked });

  const handleUnblock = async (userId: string) => {
    await unblock(userId);
    void queryClient.invalidateQueries({ queryKey: qk.blocks() });
    void queryClient.invalidateQueries(); // surfaces return after refetch
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Blocked accounts</Text>
      </View>

      <FlatList
        data={query.data ?? []}
        keyExtractor={(b) => b.blocked_id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.sp8 }]}
        ListEmptyComponent={
          query.isLoading ? null : (
            <Text style={[textStyles.body, styles.empty]}>
              Nobody blocked. Hopefully it stays that way.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar
              name={item.profile?.display_name ?? '?'}
              src={item.profile?.avatar_url ?? undefined}
              size="md"
            />
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{item.profile?.display_name ?? 'Runner'}</Text>
              <Text style={textStyles.caption}>
                Blocked {formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })}
              </Text>
            </View>
            <Button
              label="UNBLOCK"
              size="sm"
              variant="ghost"
              onPress={() => void handleUnblock(item.blocked_id)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
    paddingHorizontal: spacing.sp3,
    paddingBottom: spacing.sp2,
  },
  list: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    gap: spacing.sp3,
  },
  empty: { textAlign: 'center', paddingVertical: spacing.sp10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    padding: spacing.sp3,
  },
  rowText: { flex: 1 },
  rowName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: colors.ink900,
  },
});
