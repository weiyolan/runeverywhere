/**
 * Pure track math (P4 E2) — filter pipeline, distance, D+ hysteresis, pace,
 * polyline encoding. No expo imports: unit-tested in vitest.
 *
 * Thresholds (P4 decisions): drop accuracy > 30 m, speed > 12.5 m/s,
 * out-of-order samples; 3 m movement anchor; D+ = 3 m hysteresis gated by
 * altitude accuracy ≤ 10 m (fallback: overall accuracy ≤ 20 m); pace over the
 * trailing 45 s clamped to 2:00–30:00 /km.
 */
import polyline from '@mapbox/polyline';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TrackPoint extends LatLng {
  /** Epoch millis. */
  t: number;
  alt: number | null;
  acc: number;
  altAcc: number | null;
}

export interface TrackState {
  lastAccepted: TrackPoint | null;
  /** Movement anchor — advances only on ≥ 3 m moves (standstill gate). */
  anchor: TrackPoint | null;
  distanceM: number;
  elevationM: number;
  /** Low-water altitude anchor for the D+ hysteresis. */
  elevAnchor: number | null;
}

const MAX_ACCURACY_M = 30;
const MAX_SPEED_MS = 12.5;
const MOVE_ANCHOR_M = 3;
const ELEV_HYSTERESIS_M = 3;
const MAX_ALT_ACC_M = 10;
const FALLBACK_ACC_M = 20;
const PACE_WINDOW_MS = 45000;
const PACE_MIN_DIST_M = 50;
const PACE_MIN_S_PER_KM = 120;
const PACE_MAX_S_PER_KM = 1800;
const MAX_ENCODED_POINTS = 2000;

const EARTH_R = 6371000;

export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}

export function createTrackState(): TrackState {
  return { lastAccepted: null, anchor: null, distanceM: 0, elevationM: 0, elevAnchor: null };
}

function altitudeUsable(p: TrackPoint): boolean {
  if (p.alt == null) return false;
  if (p.altAcc != null) return p.altAcc <= MAX_ALT_ACC_M;
  return p.acc <= FALLBACK_ACC_M;
}

/** Run one sample through the filter pipeline; returns the next state. */
export function addSample(
  state: TrackState,
  next: TrackPoint,
): { state: TrackState; accepted: boolean } {
  if (
    !Number.isFinite(next.lat) ||
    !Number.isFinite(next.lng) ||
    Math.abs(next.lat) > 90 ||
    Math.abs(next.lng) > 180 ||
    next.acc > MAX_ACCURACY_M
  ) {
    return { state, accepted: false };
  }
  const prev = state.lastAccepted;
  if (prev) {
    if (next.t <= prev.t) return { state, accepted: false };
    const speed = haversineM(prev, next) / ((next.t - prev.t) / 1000);
    if (speed > MAX_SPEED_MS) return { state, accepted: false };
  }

  let { anchor, distanceM, elevationM, elevAnchor } = state;

  if (!anchor) {
    anchor = next;
  } else {
    const move = haversineM(anchor, next);
    if (move >= MOVE_ANCHOR_M) {
      distanceM += move;
      anchor = next;
    }
  }

  if (altitudeUsable(next)) {
    const alt = next.alt!;
    if (elevAnchor == null) {
      elevAnchor = alt;
    } else if (alt < elevAnchor) {
      elevAnchor = alt; // descending re-arms the next climb
    } else if (alt - elevAnchor >= ELEV_HYSTERESIS_M) {
      elevationM += alt - elevAnchor;
      elevAnchor = alt;
    }
  }

  return {
    state: { lastAccepted: next, anchor, distanceM, elevationM, elevAnchor },
    accepted: true,
  };
}

/**
 * Pace over the trailing 45 s of accepted movement, in s/km. Null when the
 * window holds < 50 m or the result falls outside 2:00–30:00 /km.
 */
export function currentPaceSPerKm(accepted: TrackPoint[], nowMs: number): number | null {
  const cutoff = nowMs - PACE_WINDOW_MS;
  const window = accepted.filter((p) => p.t >= cutoff);
  if (window.length < 2) return null;
  let dist = 0;
  for (let i = 1; i < window.length; i++) dist += haversineM(window[i - 1], window[i]);
  if (dist < PACE_MIN_DIST_M) return null;
  const seconds = (window[window.length - 1].t - window[0].t) / 1000;
  const pace = seconds / (dist / 1000);
  if (pace < PACE_MIN_S_PER_KM || pace > PACE_MAX_S_PER_KM) return null;
  return Math.round(pace);
}

/** Uniform-stride downsample to ≤ 2000 points, then polyline-encode. */
export function encodeTrack(points: LatLng[]): string {
  const stride = Math.max(1, Math.ceil(points.length / MAX_ENCODED_POINTS));
  const sampled: [number, number][] = [];
  for (let i = 0; i < points.length; i += stride) {
    sampled.push([points[i].lat, points[i].lng]);
  }
  const last = points[points.length - 1];
  if (last && sampled[sampled.length - 1]?.[0] !== last.lat) {
    sampled.push([last.lat, last.lng]);
  }
  return polyline.encode(sampled);
}

export function decodeTrack(encoded: string): LatLng[] {
  return polyline.decode(encoded).map(([lat, lng]) => ({ lat, lng }));
}
