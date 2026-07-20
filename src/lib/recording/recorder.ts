/**
 * Recording lifecycle owner (P4 E5). This module boundary IS the
 * Transistorsoft escape hatch: swap recorder.ts + locationTask.ts, keep the
 * store/UI contract.
 */
import * as Location from 'expo-location';

import { colors } from '@/theme/theme';

import * as buffer from '@/lib/recording/buffer';
import { LOCATION_TASK, flushBuffer, resetPaceWindow } from '@/lib/recording/locationTask';
import { ensureRecordingPermissions } from '@/lib/recording/permissions';
import { useLiveRun } from '@/stores/liveRun';

export type RecoveryState =
  | { kind: 'none' }
  | { kind: 'resume-live'; runId: string }
  | { kind: 'salvage'; runId: string };

export async function startRecording(runId: string) {
  const permission = await ensureRecordingPermissions();
  if (permission === 'denied') throw new Error('location permission denied');

  await buffer.initSession(runId);
  resetPaceWindow();
  useLiveRun.getState().reset();
  useLiveRun.setState({
    status: 'acquiring',
    runId,
    backgroundGranted: permission === 'granted',
  });

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.Fitness,
    timeInterval: 1000,
    distanceInterval: 5,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Run Everywhere — recording',
      notificationBody: 'Tracking your run. Tap to return.',
      notificationColor: colors.volt,
      killServiceOnDestroy: false,
    },
  });
}

export async function pauseRecording() {
  const meta = await buffer.readMeta();
  if (!meta || meta.state === 'paused') return;
  await buffer.writeMeta({ ...meta, state: 'paused', pauses: [...meta.pauses, { from: Date.now() }] });
  useLiveRun.setState({ status: 'paused', currentPace: null });
}

export async function resumeRecording() {
  const meta = await buffer.readMeta();
  if (!meta || meta.state !== 'paused') return;
  const pauses = meta.pauses.map((p, i) =>
    i === meta.pauses.length - 1 && p.to == null ? { ...p, to: Date.now() } : p,
  );
  // Clear the stale speed-gate reference so the first post-pause sample
  // isn't rejected for the jump from the pause location.
  await buffer.writeMeta({
    ...meta,
    state: 'recording',
    pauses,
    track: { ...meta.track, lastAccepted: null },
  });
  useLiveRun.setState({ status: 'recording' });
}

/** Stop updates + flush; returns everything needed to build the payload. */
export async function stopRecording() {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  const meta = await buffer.readMeta();
  if (meta) await flushBuffer(meta);
  return buffer.readAll();
}

export async function discardRecording() {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  await buffer.clear();
  useLiveRun.getState().reset();
}

/** Cold-start recovery (E6). */
export async function getRecoveryState(): Promise<RecoveryState> {
  const meta = await buffer.readMeta();
  if (!meta) return { kind: 'none' };
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) return { kind: 'resume-live', runId: meta.runId };
  return { kind: 'salvage', runId: meta.runId };
}

/** Salvage path: restart location updates over the existing buffer. */
export async function resumeSalvaged() {
  const meta = await buffer.readMeta();
  if (!meta) return;
  await buffer.writeMeta({ ...meta, track: { ...meta.track, lastAccepted: null } });
  useLiveRun.setState({
    status: meta.state === 'paused' ? 'paused' : 'recording',
    runId: meta.runId,
    startedAt: meta.startedAt,
    distanceM: meta.track.distanceM,
    elevationM: meta.track.elevationM,
    movingMs: meta.movingMs,
  });
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.Fitness,
    timeInterval: 1000,
    distanceInterval: 5,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Run Everywhere — recording',
      notificationBody: 'Tracking your run. Tap to return.',
      notificationColor: colors.volt,
      killServiceOnDestroy: false,
    },
  });
}
