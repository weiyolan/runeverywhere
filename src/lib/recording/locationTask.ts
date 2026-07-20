/**
 * Background location task (P4 E1). Defined at module scope; imported for its
 * side effect at the top of src/app/_layout.tsx so the definition exists
 * before any headless invocation. Errors are swallowed — a throw can
 * unregister the task.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import {
  appendSamples,
  flush,
  readMeta,
  writeMeta,
  type SessionMeta,
} from '@/lib/recording/buffer';
import { addSample, currentPaceSPerKm, type TrackPoint } from '@/lib/recording/geo';
import { useLiveRun } from '@/stores/liveRun';

export const LOCATION_TASK = 're.live-run';

/** 12 h auto-stop guard (E5): beyond this the task force-finishes to salvage. */
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;

/** Trailing accepted points kept in memory for the pace window. */
let paceWindow: TrackPoint[] = [];

/** Live-share throttle (P5 G4): upsert the latest point ≤ every 20 s. */
let lastShareWriteMs = 0;
const SHARE_INTERVAL_MS = 20000;

function toTrackPoint(loc: Location.LocationObject): TrackPoint {
  return {
    t: loc.timestamp,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    alt: loc.coords.altitude ?? null,
    acc: loc.coords.accuracy ?? 999,
    altAcc: loc.coords.altitudeAccuracy ?? null,
  };
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  try {
    if (error || !data) return;
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations?.length) return;

    let meta = await readMeta();
    if (!meta) return;

    if (meta.startedAt != null && Date.now() - meta.startedAt > MAX_SESSION_MS) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
      return;
    }

    const accepted: TrackPoint[] = [];
    let track = meta.track;
    let movingMs = meta.movingMs;
    let startedAt = meta.startedAt;

    for (const loc of locations) {
      const point = toTrackPoint(loc);
      if (meta.state === 'paused') {
        // Task keeps running while paused (decision): samples are dropped
        // from accumulation but the speed gate reference must not go stale.
        continue;
      }
      const prevAccepted = track.lastAccepted;
      const res = addSample(track, point);
      if (!res.accepted) continue;
      track = res.state;
      accepted.push(point);
      if (startedAt == null) startedAt = point.t; // GPS warm-up: first accepted
      if (prevAccepted) movingMs += point.t - prevAccepted.t;
    }

    if (accepted.length > 0) {
      meta = await appendSamples({ ...meta, track, movingMs, startedAt }, accepted);
      await writeMeta(meta);
      paceWindow = [...paceWindow, ...accepted].slice(-60);
    }

    // Live share: swallow failures — the next tick retries; never block
    // recording (P5 G4).
    const share = useLiveRun.getState().shareSessionId;
    const newest = accepted[accepted.length - 1];
    if (share && newest && Date.now() - lastShareWriteMs >= SHARE_INTERVAL_MS) {
      lastShareWriteMs = Date.now();
      const { upsertLiveLocation } = await import('@/lib/safety');
      upsertLiveLocation(share, {
        lat: newest.lat,
        lng: newest.lng,
        accuracyM: newest.acc,
        distanceKm: Math.round((track.distanceM / 1000) * 100) / 100,
        elapsedS: startedAt != null ? Math.round((Date.now() - startedAt) / 1000) : undefined,
      }).catch(() => {});
    }

    useLiveRun.setState((s) => ({
      status: meta!.state === 'paused' ? 'paused' : startedAt == null ? 'acquiring' : 'recording',
      runId: meta!.runId,
      startedAt,
      distanceM: track.distanceM,
      elevationM: track.elevationM,
      movingMs,
      currentPace:
        meta!.state === 'paused' ? null : currentPaceSPerKm(paceWindow, Date.now()),
      coords:
        accepted.length > 0
          ? [...s.coords, ...accepted.map((p) => ({ lat: p.lat, lng: p.lng }))].slice(-1000)
          : s.coords,
    }));
  } catch {
    // Never throw from the task handler.
  }
});

/** Salvage/finish helper: make sure everything buffered is durable. */
export async function flushBuffer(meta: SessionMeta): Promise<SessionMeta> {
  const flushed = await flush(meta);
  await writeMeta(flushed);
  return flushed;
}

export function resetPaceWindow() {
  paceWindow = [];
}
