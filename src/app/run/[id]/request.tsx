/**
 * Request-to-join modal (P2 H3) — intro message + prompt chips.
 */
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/create/FormControls';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { spotsLeft } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { useJoinRun } from '@/lib/runMutations';
import { fetchRunDetail } from '@/lib/runs';
import { colors, fonts, sizing, spacing, textStyles, typeScale } from '@/theme/theme';

const MAX_INTRO = 240;
const PROMPTS = ['I’m new in town', 'Easy pace', 'Coffee after?'];

export default function RequestToJoinScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [intro, setIntro] = useState('');
  const join = useJoinRun(id);

  const detail = useQuery({
    queryKey: qk.run(id),
    queryFn: () => fetchRunDetail(id),
  }).data;

  const appendPrompt = (prompt: string) =>
    setIntro((cur) => (cur ? `${cur} ${prompt}` : prompt).slice(0, MAX_INTRO));

  const send = () =>
    join.mutate(intro.trim(), {
      onSuccess: () => router.back(),
    });

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + spacing.sp4 }]}>
      <View style={styles.body}>
        <Text style={textStyles.sectionHeader}>Request to join</Text>
        {detail ? (
          <Text style={textStyles.caption}>
            {detail.host?.display_name ?? 'Host'} hosts ·{' '}
            {spotsLeft(detail.run.max_group, detail.approvedCount)} spots left
          </Text>
        ) : null}
        <Input
          value={intro}
          onChangeText={(text) => setIntro(text.slice(0, MAX_INTRO))}
          multiline
          numberOfLines={4}
          autoFocus
          maxLength={MAX_INTRO}
          placeholder="Say hi and why you'd like to join — pace, experience, anything the host should know."
          hint={`${intro.length}/${MAX_INTRO}`}
        />
        <View style={styles.chipRow}>
          {PROMPTS.map((p) => (
            <Chip key={p} label={p} selected={false} onPress={() => appendPrompt(p)} />
          ))}
        </View>
        {join.isError ? (
          <Text style={styles.error}>
            {join.error instanceof Error ? join.error.message : 'Couldn’t send — try again.'}
          </Text>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Button
          label={join.isPending ? 'Sending…' : 'Send request'}
          full
          disabled={join.isPending}
          onPress={send}
        />
        <Text style={styles.footnote}>The host sees your profile, rating & this note.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper2,
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp6,
    justifyContent: 'space-between',
  },
  body: { gap: spacing.sp3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sp2 },
  error: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.danger,
  },
  footer: { gap: spacing.sp2 },
  footnote: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
    color: colors.ink400,
    textAlign: 'center',
  },
});
