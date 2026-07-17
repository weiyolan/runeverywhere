/**
 * Create step 3/4 (P2 G5) — validated details. Design steps 2+3 merged;
 * visibility cards live here (Decisions #9). Every bound mirrors the DB
 * checks via detailsStepSchema.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, Stepper, clamp, round1 } from '@/components/create/FormControls';
import { WizardHeader } from '@/components/create/WizardHeader';
import { RouteMarker } from '@/components/map/RouteMarker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatBlock } from '@/components/ui/StatBlock';
import { formatPace } from '@/lib/format';
import { detailsStepSchema } from '@/lib/validation/run';
import { useCreateRunDraft } from '@/stores/createRun';
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

const PACE_CHIPS = [390, 360, 330, 300, 270]; // 6:30 … 4:30
const TIME_CHIPS = ['06:30', '08:00', '12:00', '18:00', '19:30'];
const DAY_COUNT = 4; // today, tomorrow, +2
const MAX_DAYS_AHEAD = 30;

const VISIBILITY_CARDS: { value: Visibility; label: string; blurb: string }[] = [
  { value: 'open', label: 'Open', blurb: 'Anyone can join instantly until the run is full.' },
  {
    value: 'approval',
    label: 'Approval required',
    blurb: 'Runners request to join — you accept or decline each one.',
  },
  {
    value: 'invite',
    label: 'Invite only',
    blurb: 'Hidden from the map. Only people you share the link with can join.',
  },
];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function dayChipLabel(offset: number, d: Date) {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export default function CreateDetailsScreen() {
  const insets = useSafeAreaInsets();
  const draft = useCreateRunDraft();
  const [customPace, setCustomPace] = useState(false);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [now] = useState(() => new Date());

  const parse = useMemo(() => detailsStepSchema.safeParse(draft), [draft]);
  const fieldError = (field: string) =>
    parse.success ? undefined : parse.error.issues.find((i) => i.path[0] === field)?.message;

  const startsAt = draft.starts_at;
  const setDay = (date: Date) => {
    const next = new Date(date);
    if (startsAt) next.setHours(startsAt.getHours(), startsAt.getMinutes(), 0, 0);
    else next.setHours(8, 0, 0, 0);
    draft.set({ starts_at: next });
  };
  const setTime = (hours: number, minutes: number) => {
    const next = startsAt ? new Date(startsAt) : new Date();
    next.setHours(hours, minutes, 0, 0);
    draft.set({ starts_at: next });
  };

  const dayChips = Array.from({ length: DAY_COUNT }, (_, offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return { offset, date: d, label: dayChipLabel(offset, d) };
  });

  return (
    <View style={styles.screen}>
      <View style={styles.headerWrap}>
        <WizardHeader step={3} title="Set the details" />
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: spacing.sp8 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Input
          label="Run name"
          value={draft.title}
          onChangeText={(title) => draft.set({ title })}
          placeholder="Give it a name runners will get"
          maxLength={40}
          hint={draft.title ? (fieldError('title') ?? `${draft.title.length}/40`) : undefined}
          invalid={Boolean(draft.title) && Boolean(fieldError('title'))}
        />
        <Input
          label="Goal"
          value={draft.goal}
          onChangeText={(goal) => draft.set({ goal })}
          multiline
          placeholder="What's this run about? Pace, vibe, coffee after…"
          maxLength={200}
          hint={draft.goal ? (fieldError('goal') ?? `${draft.goal.length}/200`) : undefined}
          invalid={Boolean(fieldError('goal'))}
        />

        <Text style={textStyles.eyebrow}>DISTANCE</Text>
        <Stepper
          onMinus={() => draft.set({ distance_km: round1(clamp(draft.distance_km - 0.5, 1, 42)) })}
          onPlus={() => draft.set({ distance_km: round1(clamp(draft.distance_km + 0.5, 1, 42)) })}
        >
          <StatBlock value={draft.distance_km} unit="km" label="Distance" size="lg" />
        </Stepper>

        <Text style={textStyles.eyebrow}>MAX GROUP</Text>
        <Stepper
          onMinus={() => draft.set({ max_group: clamp(draft.max_group - 1, 2, 30) })}
          onPlus={() => draft.set({ max_group: clamp(draft.max_group + 1, 2, 30) })}
        >
          <StatBlock value={draft.max_group} unit="ppl" label="Including you" size="lg" />
        </Stepper>

        <Text style={textStyles.eyebrow}>TARGET PACE</Text>
        <View style={styles.chipRow}>
          {PACE_CHIPS.map((pace) => (
            <Chip
              key={pace}
              label={formatPace(pace).replace(' /km', '')}
              selected={!customPace && draft.target_pace_s_per_km === pace}
              onPress={() => {
                setCustomPace(false);
                draft.set({ target_pace_s_per_km: pace });
              }}
            />
          ))}
          <Chip
            label="No target"
            selected={!customPace && draft.target_pace_s_per_km === null}
            onPress={() => {
              setCustomPace(false);
              draft.set({ target_pace_s_per_km: null });
            }}
          />
          <Chip label="Custom" selected={customPace} onPress={() => {
            setCustomPace(true);
            if (draft.target_pace_s_per_km === null) draft.set({ target_pace_s_per_km: 360 });
          }} />
        </View>
        {customPace ? (
          <Stepper
            onMinus={() =>
              draft.set({
                target_pace_s_per_km: clamp((draft.target_pace_s_per_km ?? 360) - 15, 120, 720),
              })
            }
            onPlus={() =>
              draft.set({
                target_pace_s_per_km: clamp((draft.target_pace_s_per_km ?? 360) + 15, 120, 720),
              })
            }
          >
            <StatBlock
              value={draft.target_pace_s_per_km ? formatPace(draft.target_pace_s_per_km).replace(' /km', '') : '—'}
              unit="/km"
              label="Target pace"
            />
          </Stepper>
        ) : null}

        <Text style={textStyles.eyebrow}>WHEN</Text>
        <View style={styles.chipRow}>
          {dayChips.map((d) => (
            <Chip
              key={d.offset}
              label={d.label}
              selected={Boolean(startsAt && sameDay(startsAt, d.date))}
              onPress={() => setDay(d.date)}
            />
          ))}
          <Chip label="Pick date" selected={false} onPress={() => setPicker('date')} />
        </View>
        <View style={styles.chipRow}>
          {TIME_CHIPS.map((t) => {
            const [h, m] = t.split(':').map(Number);
            const selected = Boolean(
              startsAt && startsAt.getHours() === h && startsAt.getMinutes() === m,
            );
            return <Chip key={t} label={t} selected={selected} onPress={() => setTime(h, m)} />;
          })}
          <Chip label="Pick time" selected={false} onPress={() => setPicker('time')} />
        </View>
        {startsAt ? (
          <Text style={textStyles.caption}>
            Starts {startsAt.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
        {startsAt && fieldError('starts_at') ? (
          <Text style={styles.error}>{fieldError('starts_at')}</Text>
        ) : null}
        {picker ? (
          <DateTimePicker
            value={startsAt ?? new Date()}
            mode={picker}
            minimumDate={now}
            maximumDate={new Date(now.getTime() + MAX_DAYS_AHEAD * 86_400_000)}
            onChange={(event, date) => {
              setPicker(null);
              if (event.type === 'dismissed' || !date) return;
              if (picker === 'date') setDay(date);
              else setTime(date.getHours(), date.getMinutes());
            }}
          />
        ) : null}

        <Text style={textStyles.eyebrow}>ROUTE</Text>
        <View style={styles.chipRow}>
          <Chip
            label="Open route"
            selected={!draft.closed_loop}
            onPress={() => draft.set({ closed_loop: false })}
          />
          <Chip
            label="Closed loop"
            selected={draft.closed_loop}
            onPress={() => draft.set({ closed_loop: true })}
            icon={<RouteMarker kind="closed" type={draft.type ?? 'discover'} size={18} />}
          />
        </View>

        <Text style={textStyles.eyebrow}>WHO CAN JOIN</Text>
        <View style={styles.visibilityCards}>
          {VISIBILITY_CARDS.map((v) => (
            <Pressable
              key={v.value}
              accessibilityRole="button"
              accessibilityState={{ selected: draft.visibility === v.value }}
              onPress={() => draft.set({ visibility: v.value })}
              style={[styles.card, draft.visibility === v.value && styles.cardSelected]}
            >
              <Text style={styles.cardLabel}>{v.label}</Text>
              <Text style={styles.cardBlurb}>{v.blurb}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sp4 }]}>
        <Button
          label="Continue"
          full
          disabled={!parse.success}
          onPress={() => router.push('/create/review')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  headerWrap: { paddingHorizontal: sizing.gutter, paddingBottom: spacing.sp3 },
  body: { paddingHorizontal: sizing.gutter, gap: spacing.sp3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sp2 },
  error: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tXs,
    color: colors.danger,
  },
  visibilityCards: { gap: spacing.sp2 },
  card: {
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    borderWidth: borderWidth.bold,
    borderColor: colors.ink200,
    padding: spacing.sp4,
    gap: 4,
  },
  cardSelected: { borderColor: colors.ink900 },
  cardLabel: {
    fontFamily: fonts.display,
    fontSize: typeScale.tSm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.ink900,
  },
  cardBlurb: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: semantic.textSecondary,
  },
  footer: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    backgroundColor: colors.paper2,
  },
});
