/**
 * Rate-the-crew (P4 H3). Crew list ⇄ inner rate form (not a separate route,
 * matching the design's recap loop). submit_review owns the +10-once rule.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SelectChip } from '@/components/onboarding/SelectChip';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { RatingStars } from '@/components/ui/RatingStars';
import { formatWhen } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { fetchCrew, REVIEW_TAGS, submitReview, type CrewMember } from '@/lib/reviews';
import { fetchRunDetail } from '@/lib/runs';
import {
  colors,
  fonts,
  letterSpacing,
  radius,
  sizing,
  spacing,
  textStyles,
  tracking,
  typeScale,
} from '@/theme/theme';

const STAR_LABELS = ['', 'Rough run', 'Not great', 'Solid', 'Great to run with', 'Outstanding'];

export default function ReviewScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [target, setTarget] = useState<CrewMember | null>(null);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: qk.run(runId ?? ''),
    queryFn: () => fetchRunDetail(runId!),
    enabled: runId != null,
  }).data;

  const crewQuery = useQuery({
    queryKey: ['run', runId ?? '', 'crew'],
    queryFn: () => fetchCrew(runId!),
    enabled: runId != null,
  });

  const openForm = (member: CrewMember) => {
    setTarget(member);
    setStars(0);
    setTags([]);
    setNote('');
    setError(null);
  };

  const submit = async () => {
    if (!runId || !target || stars < 1) return;
    setWorking(true);
    setError(null);
    try {
      const res = await submitReview({
        runId,
        revieweeId: target.user_id,
        stars,
        tags,
        note: note.trim(),
      });
      await crewQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['run', runId, 'awards'] });
      void queryClient.invalidateQueries({ queryKey: qk.run(runId) });
      setTarget(null);
      if (res.rate_crew_awarded) {
        setToast('+10 PTS EARNED');
        setTimeout(() => setToast(null), 2500);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (message.includes('already reviewed')) {
        setError('You already reviewed this runner.');
        await crewQuery.refetch();
      } else {
        setError('Could not save the review — try again.');
      }
    } finally {
      setWorking(false);
    }
  };

  const dateLine = detail ? `${detail.run.title} · ${formatWhen(detail.run.starts_at)}` : '';

  if (target) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sp3, paddingBottom: insets.bottom + spacing.sp8 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => setTarget(null)}>
            <ArrowLeft size={22} />
          </IconButton>
          <View>
            <Text style={textStyles.sectionHeader}>Rate runner</Text>
            <Text style={textStyles.caption}>{dateLine}</Text>
          </View>
        </View>

        <View style={styles.targetBlock}>
          <Avatar name={target.display_name} src={target.avatar_url ?? undefined} size="xl" />
          <Text style={styles.targetName}>{target.display_name}</Text>
          <Text style={textStyles.caption}>{target.isHost ? 'Host' : 'Runner'}</Text>
        </View>

        <View style={styles.starsBlock}>
          <RatingStars value={stars} size={40} onRate={setStars} />
          <Text style={styles.starLabel}>{STAR_LABELS[stars] || ' '}</Text>
        </View>

        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>WHAT STOOD OUT</Text>
          <View style={styles.tagRow}>
            {REVIEW_TAGS.map((tag) => (
              <SelectChip
                key={tag}
                label={tag}
                selected={tags.includes(tag)}
                onPress={() =>
                  setTags((prev) =>
                    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>ADD A NOTE · OPTIONAL</Text>
          <Input
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={200}
            placeholder="Say something the next runner should know — pace, vibe, local knowledge."
            hint={`${note.length}/200`}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={working ? 'SUBMITTING…' : 'SUBMIT REVIEW'}
          full
          disabled={stars < 1 || working}
          onPress={() => void submit()}
        />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={[styles.header, styles.gutter]}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <View>
          <Text style={textStyles.sectionHeader}>Rate the crew</Text>
          <Text style={textStyles.caption}>{dateLine}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.sp8 }]}>
        {(crewQuery.data ?? []).map((member) => (
          <Pressable
            key={member.user_id}
            style={styles.crewRow}
            disabled={member.myStars != null}
            onPress={() => openForm(member)}
          >
            <Avatar name={member.display_name} src={member.avatar_url ?? undefined} size="md" />
            <View style={styles.crewText}>
              <Text style={styles.crewName}>{member.display_name}</Text>
              <Text style={textStyles.caption}>{member.isHost ? 'Host' : 'Runner'}</Text>
            </View>
            {member.myStars != null ? (
              <RatingStars value={member.myStars} size={14} />
            ) : (
              <View style={styles.rateChip}>
                <Text style={styles.rateChipText}>RATE</Text>
              </View>
            )}
          </Pressable>
        ))}
        {crewQuery.data?.length === 0 ? (
          <Text style={[textStyles.body, styles.gutter]}>No one else ran this one.</Text>
        ) : null}
        <View style={[styles.gutter, { marginTop: spacing.sp4 }]}>
          <Button label="DONE" variant="secondary" full onPress={() => router.back()} />
        </View>
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + spacing.sp6 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  content: {
    paddingHorizontal: sizing.gutter,
    gap: spacing.sp5,
  },
  gutter: { paddingHorizontal: sizing.gutter },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    paddingBottom: spacing.sp2,
  },
  list: {
    paddingTop: spacing.sp3,
    gap: spacing.sp3,
    paddingHorizontal: sizing.gutter,
  },
  targetBlock: {
    alignItems: 'center',
    gap: spacing.sp2,
  },
  targetName: {
    fontFamily: fonts.display,
    fontSize: typeScale.d3,
    color: colors.ink900,
    letterSpacing: letterSpacing(typeScale.d3, tracking.caps),
    textTransform: 'uppercase',
  },
  starsBlock: {
    alignItems: 'center',
    gap: spacing.sp2,
  },
  starLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.ink500,
    minHeight: 20,
  },
  section: { gap: spacing.sp3 },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sp2,
  },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink100,
    padding: spacing.sp4,
  },
  crewText: { flex: 1 },
  crewName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: colors.ink900,
  },
  rateChip: {
    backgroundColor: colors.volt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp4,
    paddingVertical: 6,
  },
  rateChipText: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tXs,
    color: colors.voltInk,
  },
  error: {
    ...textStyles.caption,
    color: colors.danger,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.ink900,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp5,
    paddingVertical: spacing.sp3,
  },
  toastText: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tSm,
    color: colors.volt,
  },
});
