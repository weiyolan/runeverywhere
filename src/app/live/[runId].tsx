/**
 * Live run screen (P4 F). Light map + dark console per the Reward Loop
 * design. The recording task feeds the store; this screen renders it and
 * owns the finish/salvage flows.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pause, Play, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMap, AppMarker, type AppMapHandle } from '@/components/map/AppMap';
import { Button } from '@/components/ui/Button';
import { AppPolyline } from '@/components/map/AppMap';
import { StatBlock } from '@/components/ui/StatBlock';
import { formatPace } from '@/lib/format';
import { regionForRadius } from '@/lib/geo';
import { qk } from '@/lib/queryKeys';
import { readAll } from '@/lib/recording/buffer';
import { encodeTrack } from '@/lib/recording/geo';
import {
  discardRecording,
  resumeSalvaged,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
} from '@/lib/recording/recorder';
import { fetchRunDetail } from '@/lib/runs';
import { completeRun, uploadRawSamples } from '@/lib/tracks';
import { useLiveRun } from '@/stores/liveRun';
import {
  colors,
  fonts,
  letterSpacing,
  radius,
  runType,
  shadows,
  sizing,
  spacing,
  tracking,
  typeScale,
} from '@/theme/theme';

const MIN_FINISH_DISTANCE_M = 100;
const MIN_FINISH_DURATION_MS = 60000;
const CONFIRM_BELOW_M = 500;

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export default function LiveRunScreen() {
  const { runId, salvage } = useLocalSearchParams<{ runId: string; salvage?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const mapRef = useRef<AppMapHandle>(null);

  const live = useLiveRun();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [salvageMode, setSalvageMode] = useState(salvage === '1');
  const [finishError, setFinishError] = useState(false);
  const [confirmSheet, setConfirmSheet] = useState(false);

  const detail = useQuery({
    queryKey: qk.run(runId ?? ''),
    queryFn: () => fetchRunDetail(runId!),
    enabled: runId != null,
  }).data;

  // Start on mount when nothing is running (F4 guard).
  useEffect(() => {
    if (!runId || salvageMode) return;
    const state = useLiveRun.getState();
    if (state.status === 'idle') {
      startRecording(runId).catch(() =>
        Alert.alert('Location needed', 'Run Everywhere cannot record without location access.', [
          { text: 'OK', onPress: () => router.back() },
        ]),
      );
    } else if (state.runId && state.runId !== runId) {
      Alert.alert('Already recording', 'Another run is being recorded.', [
        { text: 'GO TO IT', onPress: () => router.replace(`/live/${state.runId}`) },
      ]);
    }
  }, [runId, salvageMode]);

  // Elapsed ticker from startedAt while focused.
  useEffect(() => {
    const tick = () => {
      const { startedAt, status } = useLiveRun.getState();
      if (startedAt == null) return setElapsedMs(0);
      if (status === 'paused' || status === 'finishing') return;
      setElapsedMs(Date.now() - startedAt);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Camera follows the latest point.
  const lastCoord = live.coords[live.coords.length - 1];
  useEffect(() => {
    if (lastCoord) {
      mapRef.current?.animateToCoordinate({ latitude: lastCoord.lat, longitude: lastCoord.lng });
    }
  }, [lastCoord]);

  // Blink dot
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = withRepeat(withTiming(0.2, { duration: 700 }), -1, true);
  }, [blink]);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  const finishSequence = async () => {
    if (!runId) return;
    useLiveRun.setState({ status: 'finishing' });
    setFinishError(false);
    try {
      const data = (await stopRecording()) ?? (await readAll());
      if (!data || data.samples.length === 0) throw new Error('no samples');
      const { meta, samples } = data;
      const startedAt = meta.startedAt ?? samples[0].t;
      const endedAt = samples[samples.length - 1].t;
      const { data: userRes } = await (await import('@/lib/supabase')).supabase.auth.getUser();
      const uid = userRes.user?.id;
      const rawPath = uid ? `${uid}/${runId}.json.gz` : undefined;

      const result = await completeRun({
        runId,
        polyline: encodeTrack(samples),
        distanceM: Math.round(meta.track.distanceM),
        durationS: Math.max(60, Math.round(meta.movingMs / 1000)),
        elevationGainM: Math.round(meta.track.elevationM),
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        rawPath,
      });

      if (rawPath) {
        // Best-effort: one retry, then tolerate a dangling raw_path.
        try {
          await uploadRawSamples(rawPath, samples);
        } catch {
          await uploadRawSamples(rawPath, samples).catch(() => {});
        }
      }

      const { clear } = await import('@/lib/recording/buffer');
      await clear();
      useLiveRun.getState().reset();
      void queryClient.invalidateQueries({ queryKey: qk.run(runId) });
      void queryClient.invalidateQueries({ queryKey: qk.runsMine() });
      router.replace({
        pathname: '/recap/[trackId]',
        params: { trackId: result.track_id, result: JSON.stringify(result), runId },
      });
    } catch {
      useLiveRun.setState({ status: 'paused' });
      setFinishError(true);
    }
  };

  const canFinish =
    live.distanceM >= MIN_FINISH_DISTANCE_M && live.movingMs >= MIN_FINISH_DURATION_MS;

  const onFinishPress = () => {
    if (live.distanceM < CONFIRM_BELOW_M) {
      setConfirmSheet(true);
    } else {
      void finishSequence();
    }
  };

  const discard = async () => {
    await discardRecording();
    router.replace(runId ? `/run/${runId}` : '/(tabs)');
  };

  const paused = live.status === 'paused';
  const acquiring = live.status === 'acquiring';
  const finishing = live.status === 'finishing';
  const type = detail?.run.type ?? 'discover';
  const start = detail?.run.point;

  const kmValue = (live.distanceM / 1000).toFixed(2);
  const paceValue = live.currentPace != null ? formatPace(live.currentPace).replace(' /km', '') : '—:—';

  return (
    <View style={styles.screen}>
      {start ? (
        <AppMap
          ref={mapRef}
          initialRegion={regionForRadius(start, 500)}
          showsUserLocation={false}
          style={StyleSheet.absoluteFill}
        >
          {live.coords.length > 1 ? (
            <AppPolyline coordinates={live.coords.map((c) => ({ latitude: c.lat, longitude: c.lng }))} strokeColor={colors.go} strokeWidth={6} />
          ) : null}
          {lastCoord ? (
            <AppMarker
              coordinate={{ latitude: lastCoord.lat, longitude: lastCoord.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.runnerDot} />
            </AppMarker>
          ) : null}
        </AppMap>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper3 }]} />
      )}

      {/* Top pills */}
      <View style={[styles.topPills, { top: insets.top + spacing.sp3 }]}>
        <View style={styles.livePill}>
          <Animated.View
            style={[
              styles.liveDot,
              { backgroundColor: acquiring ? colors.warn : colors.go },
              blinkStyle,
            ]}
          />
          <Text style={styles.livePillText}>
            {acquiring ? 'ACQUIRING GPS…' : paused ? 'PAUSED' : 'LIVE · RECORDING'}
          </Text>
        </View>
        {!live.backgroundGranted ? (
          <Pressable style={styles.warnBanner} onPress={() => void Linking.openSettings()}>
            <Text style={styles.warnText}>
              KEEP THE SCREEN ON — background permission off. FIX
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Bottom console */}
      <View
        style={[
          styles.console,
          paused && styles.consolePaused,
          { paddingBottom: insets.bottom + spacing.sp4 },
        ]}
      >
        <View style={styles.consoleHeader}>
          <View style={styles.consoleTitleBlock}>
            <Text style={styles.consoleEyebrow}>
              {runType[type].label} · {detail?.run.title ?? ''}
            </Text>
          </View>
          {detail ? (
            <View style={styles.pointsPill}>
              <Text style={styles.pointsPillText}>+{detail.run.points_reward} pts</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.elapsedLabel}>ELAPSED</Text>
        <Text style={styles.elapsed}>{formatElapsed(elapsedMs)}</Text>

        <View style={styles.statStrip}>
          <StatBlock value={kmValue} label="KM" size="md" accent={colors.paper} />
          <StatBlock value={paused ? '—:—' : paceValue} label="/KM" size="md" accent={colors.paper} />
          <StatBlock value={String(Math.round(live.elevationM))} label="D+ M" size="md" accent={colors.paper} />
        </View>

        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            style={styles.pauseButton}
            onPress={() => void (paused ? resumeRecording() : pauseRecording())}
            disabled={acquiring || finishing}
          >
            {paused ? <Play size={18} color={colors.paper} /> : <Pause size={18} color={colors.paper} />}
            <Text style={styles.pauseLabel}>{paused ? 'RESUME' : 'PAUSE'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.finishButton}
            onPress={onFinishPress}
            disabled={finishing}
          >
            <Square size={16} color={colors.voltInk} fill={colors.voltInk} />
            <Text style={styles.finishLabel}>FINISH RUN</Text>
          </Pressable>
        </View>
      </View>

      {/* Finishing overlay */}
      {finishing ? (
        <View style={styles.finishingOverlay}>
          <ActivityIndicator size="large" color={colors.volt} />
          <Text style={styles.finishingText}>SAVING YOUR RUN…</Text>
        </View>
      ) : null}

      {/* Short-run confirm sheet */}
      <Modal visible={confirmSheet} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>NOT MUCH RECORDED YET.</Text>
            <Button label="KEEP RUNNING" full onPress={() => setConfirmSheet(false)} />
            {canFinish ? (
              <Button
                label="FINISH ANYWAY"
                variant="secondary"
                full
                onPress={() => {
                  setConfirmSheet(false);
                  void finishSequence();
                }}
              />
            ) : null}
            <Button
              label="DISCARD RUN"
              variant="danger"
              full
              onPress={() => {
                setConfirmSheet(false);
                void discard();
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Salvage takeover */}
      <Modal visible={salvageMode} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>RECORDING INTERRUPTED</Text>
            <Text style={styles.modalBody}>
              We saved {(live.distanceM / 1000).toFixed(1)} km — pick up where you left off or
              finish with what&apos;s recorded.
            </Text>
            <Button
              label="RESUME RUN"
              full
              onPress={() => {
                setSalvageMode(false);
                void resumeSalvaged();
              }}
            />
            {canFinish ? (
              <Button
                label="FINISH NOW"
                variant="secondary"
                full
                onPress={() => {
                  setSalvageMode(false);
                  void finishSequence();
                }}
              />
            ) : null}
            <Button label="DISCARD" variant="danger" full onPress={() => void discard()} />
          </View>
        </View>
      </Modal>

      {/* RPC-failed retry */}
      <Modal visible={finishError} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SAVING FAILED</Text>
            <Text style={styles.modalBody}>Your run is safe on this phone.</Text>
            <Button label="TRY AGAIN" full onPress={() => void finishSequence()} />
            <Button
              label="LATER"
              variant="secondary"
              full
              onPress={() => {
                setFinishError(false);
                router.replace(runId ? `/run/${runId}` : '/(tabs)');
              }}
            />
            <Button label="DISCARD" variant="danger" full onPress={() => void discard()} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  runnerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.volt,
    borderWidth: 3,
    borderColor: colors.paper,
    ...shadows.pin,
  },
  topPills: {
    position: 'absolute',
    left: sizing.gutter,
    right: sizing.gutter,
    gap: spacing.sp2,
    alignItems: 'flex-start',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
    backgroundColor: colors.ink900,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp4,
    height: 36,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  livePillText: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tXs,
    letterSpacing: letterSpacing(typeScale.tXs, tracking.label),
    color: colors.paper,
  },
  warnBanner: {
    backgroundColor: colors.warnSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sp3,
    paddingVertical: spacing.sp2,
  },
  warnText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.t2xs,
    color: colors.ink900,
  },
  console: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ink900,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp5,
    gap: spacing.sp2,
  },
  consolePaused: {
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.warn,
  },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sp3,
  },
  consoleTitleBlock: { flex: 1 },
  consoleEyebrow: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.dEyebrow,
    letterSpacing: letterSpacing(typeScale.dEyebrow, tracking.label),
    color: colors.ink300,
    textTransform: 'uppercase',
  },
  pointsPill: {
    backgroundColor: colors.volt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp3,
    paddingVertical: 4,
  },
  pointsPillText: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tXs,
    color: colors.voltInk,
  },
  elapsedLabel: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.t2xs,
    letterSpacing: letterSpacing(typeScale.t2xs, tracking.label),
    color: colors.ink500,
    marginTop: spacing.sp2,
  },
  elapsed: {
    fontFamily: fonts.displayBlack,
    fontSize: 76,
    lineHeight: 80,
    color: colors.paper,
    fontVariant: ['tabular-nums'],
  },
  statStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sp2,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sp3,
    marginTop: spacing.sp4,
  },
  pauseButton: {
    flex: 1,
    height: sizing.controlH,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.ink700,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sp2,
  },
  pauseLabel: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tSm,
    letterSpacing: letterSpacing(typeScale.tSm, tracking.caps),
    color: colors.paper,
  },
  finishButton: {
    flex: 1.3,
    height: sizing.controlH,
    borderRadius: radius.sm,
    backgroundColor: colors.volt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sp2,
    ...shadows.volt,
  },
  finishLabel: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tSm,
    letterSpacing: letterSpacing(typeScale.tSm, tracking.caps),
    color: colors.voltInk,
  },
  finishingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,11,12,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sp4,
  },
  finishingText: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tMd,
    letterSpacing: letterSpacing(typeScale.tMd, tracking.caps),
    color: colors.paper,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,11,12,0.6)',
    justifyContent: 'center',
    paddingHorizontal: sizing.gutter,
  },
  modalCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: spacing.sp5,
    gap: spacing.sp3,
  },
  modalTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d3,
    color: colors.ink900,
  },
  modalBody: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: colors.ink500,
  },
});
