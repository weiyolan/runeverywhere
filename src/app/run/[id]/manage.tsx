/**
 * Manage run (P2 I2) — host tools: requests/roster/share/cancel + inline edit.
 * type and start point stay immutable post-publish (Decisions #13).
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, Stepper, clamp, round1 } from '@/components/create/FormControls';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { StatBlock } from '@/components/ui/StatBlock';
import { formatKm, formatPace, formatWhen } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { useCancelRun, useUpdateRun } from '@/lib/runMutations';
import { fetchRunDetail, fetchRunMembers } from '@/lib/runs';
import { shareRunInvite } from '@/lib/share';
import { editDetailsSchema } from '@/lib/validation/run';
import { useSession } from '@/stores/session';
import type { Database } from '@/types/database.types';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  semantic,
  sizing,
  spacing,
  textStyles,
  typeScale,
} from '@/theme/theme';

type Visibility = Database['public']['Enums']['run_visibility'];

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'approval', label: 'Approval' },
  { value: 'invite', label: 'Invite only' },
];

function ActionRow({ label, caption, danger, onPress }: { label: string; caption?: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionRow}>
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, danger && { color: colors.danger }]}>{label}</Text>
        {caption ? <Text style={textStyles.caption}>{caption}</Text> : null}
      </View>
      <ChevronRight size={18} color={danger ? colors.danger : colors.ink400} />
    </Pressable>
  );
}

export default function ManageRunScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useSession((s) => s.session?.user.id);

  const query = useQuery({ queryKey: qk.run(id), queryFn: () => fetchRunDetail(id) });
  const detail = query.data;
  const isHost = Boolean(detail && uid && detail.run.host_id === uid);
  const members = useQuery({
    queryKey: qk.runMembers(id),
    queryFn: () => fetchRunMembers(id),
    enabled: isHost,
  });
  const pendingCount = (members.data ?? []).filter((m) => m.status === 'pending').length;
  useEffect(() => {
    if (detail && !isHost) router.replace(`/run/${id}`);
  }, [detail, isHost, id]);

  const update = useUpdateRun(id);
  const cancelRun = useCancelRun(id);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [distanceKm, setDistanceKm] = useState(5);
  const [maxGroup, setMaxGroup] = useState(8);
  const [pace, setPace] = useState<number | null>(null);
  const [startsAt, setStartsAt] = useState<Date>(new Date());
  const [closedLoop, setClosedLoop] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('approval');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);

  if (!detail) return <View style={styles.screen} />;
  const { run, approvedCount } = detail;
  const minGroup = Math.max(2, approvedCount + 1);

  const startEditing = () => {
    setTitle(run.title);
    setGoal(run.goal);
    setDistanceKm(run.distance_km);
    setMaxGroup(run.max_group);
    setPace(run.target_pace_s_per_km);
    setStartsAt(new Date(run.starts_at));
    setClosedLoop(run.closed_loop);
    setVisibility(run.visibility);
    setEditing(true);
  };

  const draftPatch = {
    title,
    goal,
    distance_km: distanceKm,
    max_group: maxGroup,
    target_pace_s_per_km: pace,
    starts_at: startsAt,
    closed_loop: closedLoop,
  };
  const parse = editDetailsSchema.safeParse(draftPatch);

  const save = () => {
    if (!parse.success) return;
    // Lead rule only re-applies when the start time itself moved
    const startChanged = startsAt.getTime() !== new Date(run.starts_at).getTime();
    if (startChanged && startsAt.getTime() < Date.now() + 15 * 60 * 1000) {
      Alert.alert('Too soon', 'A new start time must be at least 15 minutes from now.');
      return;
    }
    update.mutate(
      {
        ...parse.data,
        starts_at: parse.data.starts_at.toISOString(),
        visibility,
      },
      {
        onSuccess: () => setEditing(false),
        onError: (e) => Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Try again.'),
      },
    );
  };

  const confirmCancel = () =>
    Alert.alert('Cancel this run?', 'Everyone approved will see it as cancelled.', [
      { text: 'Keep run', style: 'cancel' },
      {
        text: 'Cancel run',
        style: 'destructive',
        onPress: () =>
          cancelRun.mutate(undefined, { onSuccess: () => router.back() }),
      },
    ]);

  const share = () => shareRunInvite(run);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp2 }]}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={20} />
        </IconButton>
        <View>
          <Text style={textStyles.eyebrow}>
            HOSTING · {run.visibility.toUpperCase()}
          </Text>
          <Text style={textStyles.cardTitle}>{run.title}</Text>
        </View>
      </View>
      <Text style={[textStyles.caption, styles.statsLine]}>
        {formatKm(run.distance_km)}
        {run.target_pace_s_per_km ? ` · ${formatPace(run.target_pace_s_per_km)}` : ''} ·{' '}
        {formatWhen(run.starts_at)}
      </Text>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.sp8 }]}>
        {!editing ? (
          <>
            <ActionRow
              label="Join requests"
              caption={`${pendingCount} waiting`}
              onPress={() => router.push(`/run/${id}/requests`)}
            />
            <ActionRow
              label="Roster"
              caption={`${approvedCount + 1} going`}
              onPress={() => router.push(`/run/${id}/roster`)}
            />
            <ActionRow label="Edit run" caption="Details, pace, time" onPress={startEditing} />
            <ActionRow label="Share invite link" onPress={share} />
            <ActionRow label="Cancel run" danger onPress={confirmCancel} />
          </>
        ) : (
          <>
            <Input label="Run name" value={title} onChangeText={setTitle} maxLength={40} />
            <Input label="Goal" value={goal} onChangeText={setGoal} multiline maxLength={200} />

            <Text style={textStyles.eyebrow}>DISTANCE</Text>
            <Stepper
              onMinus={() => setDistanceKm((v) => round1(clamp(v - 0.5, 1, 42)))}
              onPlus={() => setDistanceKm((v) => round1(clamp(v + 0.5, 1, 42)))}
            >
              <StatBlock value={distanceKm} unit="km" label="Distance" />
            </Stepper>

            <Text style={textStyles.eyebrow}>MAX GROUP</Text>
            <Stepper
              onMinus={() => setMaxGroup((v) => clamp(v - 1, minGroup, 30))}
              onPlus={() => setMaxGroup((v) => clamp(v + 1, minGroup, 30))}
            >
              <StatBlock value={maxGroup} unit="ppl" label={`Min ${minGroup} (approved)`} />
            </Stepper>

            <Text style={textStyles.eyebrow}>TARGET PACE</Text>
            <Stepper
              onMinus={() => setPace((v) => clamp((v ?? 360) - 15, 120, 720))}
              onPlus={() => setPace((v) => clamp((v ?? 360) + 15, 120, 720))}
            >
              <StatBlock
                value={pace ? formatPace(pace).replace(' /km', '') : '—'}
                unit="/km"
                label="Target pace"
              />
            </Stepper>
            <View style={styles.chipRow}>
              <Chip label="No target" selected={pace === null} onPress={() => setPace(null)} />
            </View>

            <Text style={textStyles.eyebrow}>WHEN</Text>
            <View style={styles.chipRow}>
              <Chip label="Pick date" selected={false} onPress={() => setPicker('date')} />
              <Chip label="Pick time" selected={false} onPress={() => setPicker('time')} />
            </View>
            <Text style={textStyles.caption}>Starts {formatWhen(startsAt)}</Text>
            {picker ? (
              <DateTimePicker
                value={startsAt}
                mode={picker}
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setPicker(null);
                  if (event.type === 'dismissed' || !date) return;
                  setStartsAt((cur) => {
                    const next = new Date(cur);
                    if (picker === 'date') next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                    else next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                    return next;
                  });
                }}
              />
            ) : null}

            <Text style={textStyles.eyebrow}>ROUTE</Text>
            <View style={styles.chipRow}>
              <Chip label="Open route" selected={!closedLoop} onPress={() => setClosedLoop(false)} />
              <Chip label="Closed loop" selected={closedLoop} onPress={() => setClosedLoop(true)} />
            </View>

            <Text style={textStyles.eyebrow}>WHO CAN JOIN</Text>
            <View style={styles.chipRow}>
              {VISIBILITY_OPTIONS.map((v) => (
                <Chip
                  key={v.value}
                  label={v.label}
                  selected={visibility === v.value}
                  onPress={() => setVisibility(v.value)}
                />
              ))}
            </View>

            <View style={styles.editActions}>
              <Button
                label={update.isPending ? 'Saving…' : 'Save changes'}
                full
                disabled={!parse.success || update.isPending}
                onPress={save}
              />
              <Button label="Discard" variant="ghost" full onPress={() => setEditing(false)} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    paddingHorizontal: sizing.gutter,
    paddingBottom: spacing.sp1,
  },
  statsLine: { paddingHorizontal: sizing.gutter, paddingBottom: spacing.sp3 },
  body: { paddingHorizontal: sizing.gutter, gap: spacing.sp3 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    padding: spacing.sp4,
  },
  actionText: { gap: 2 },
  actionLabel: {
    fontFamily: fonts.display,
    fontSize: typeScale.tMd,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.ink900,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sp2 },
  editActions: { gap: spacing.sp2, marginTop: spacing.sp3 },
});
