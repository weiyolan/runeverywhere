import polyline from '@mapbox/polyline';
import { describe, expect, it } from 'vitest';

import {
  addSample,
  createTrackState,
  currentPaceSPerKm,
  encodeTrack,
  haversineM,
  type TrackPoint,
} from '@/lib/recording/geo';

const base = { alt: 10, acc: 5, altAcc: 3 };
const pt = (t: number, lat: number, lng: number, extra: Partial<TrackPoint> = {}): TrackPoint => ({
  t,
  lat,
  lng,
  ...base,
  ...extra,
});

// ~1 degree lat ≈ 111.32 km; 0.0001 ≈ 11.1 m of northing.
const STEP = 0.0001;

describe('haversineM', () => {
  it('measures ~11.1 m per 0.0001° latitude', () => {
    const d = haversineM({ lat: 38.7, lng: -9.2 }, { lat: 38.7 + STEP, lng: -9.2 });
    expect(d).toBeGreaterThan(10.5);
    expect(d).toBeLessThan(11.7);
  });
});

describe('addSample filter pipeline', () => {
  it('accepts a clean walk and accumulates distance', () => {
    let state = createTrackState();
    for (let i = 0; i < 10; i++) {
      const res = addSample(state, pt(i * 5000, 38.7 + i * STEP, -9.2));
      state = res.state;
      expect(res.accepted).toBe(true);
    }
    // 9 steps × ~11.1 m
    expect(state.distanceM).toBeGreaterThan(90);
    expect(state.distanceM).toBeLessThan(110);
  });

  it('rejects accuracy > 30 m', () => {
    let state = createTrackState();
    state = addSample(state, pt(0, 38.7, -9.2)).state;
    const res = addSample(state, pt(5000, 38.7 + STEP, -9.2, { acc: 45 }));
    expect(res.accepted).toBe(false);
    expect(res.state.distanceM).toBe(0);
  });

  it('rejects out-of-order timestamps', () => {
    let state = createTrackState();
    state = addSample(state, pt(10000, 38.7, -9.2)).state;
    expect(addSample(state, pt(9000, 38.7 + STEP, -9.2)).accepted).toBe(false);
  });

  it('rejects implied speed > 12.5 m/s (GPS jump)', () => {
    let state = createTrackState();
    state = addSample(state, pt(0, 38.7, -9.2)).state;
    // 111 m in 1 s
    const res = addSample(state, pt(1000, 38.7 + 10 * STEP, -9.2));
    expect(res.accepted).toBe(false);
  });

  it('standstill jitter (< 3 m moves) adds no distance', () => {
    let state = createTrackState();
    state = addSample(state, pt(0, 38.7, -9.2)).state;
    for (let i = 1; i <= 24; i++) {
      // ±1.1 m wobble every 5 s for 2 minutes
      const wobble = (i % 2 === 0 ? 1 : -1) * 0.00001;
      state = addSample(state, pt(i * 5000, 38.7 + wobble, -9.2)).state;
    }
    expect(state.distanceM).toBeLessThan(30);
  });
});

describe('elevation hysteresis', () => {
  it('adds gain only after ≥ 3 m climb and ignores poor altitude accuracy', () => {
    let state = createTrackState();
    state = addSample(state, pt(0, 38.7, -9.2, { alt: 100 })).state;
    // +2 m — below hysteresis
    state = addSample(state, pt(5000, 38.7 + STEP, -9.2, { alt: 102 })).state;
    expect(state.elevationM).toBe(0);
    // +4 m from anchor — counts
    state = addSample(state, pt(10000, 38.7 + 2 * STEP, -9.2, { alt: 104 })).state;
    expect(state.elevationM).toBeGreaterThanOrEqual(3);
    const before = state.elevationM;
    // poor altitude accuracy — ignored entirely
    state = addSample(state, pt(15000, 38.7 + 3 * STEP, -9.2, { alt: 200, altAcc: 40 })).state;
    expect(state.elevationM).toBe(before);
  });

  it('descending re-arms the anchor', () => {
    let state = createTrackState();
    state = addSample(state, pt(0, 38.7, -9.2, { alt: 100 })).state;
    state = addSample(state, pt(5000, 38.7 + STEP, -9.2, { alt: 90 })).state; // descend
    state = addSample(state, pt(10000, 38.7 + 2 * STEP, -9.2, { alt: 94 })).state; // +4 from low
    expect(state.elevationM).toBeGreaterThanOrEqual(3);
  });
});

describe('currentPaceSPerKm', () => {
  it('computes pace over the trailing window', () => {
    // 11.1 m per 5 s ≈ 2.22 m/s ≈ 450 s/km
    const points: TrackPoint[] = [];
    for (let i = 0; i < 12; i++) points.push(pt(i * 5000, 38.7 + i * STEP, -9.2));
    const pace = currentPaceSPerKm(points, 55000);
    expect(pace).not.toBeNull();
    expect(pace!).toBeGreaterThan(380);
    expect(pace!).toBeLessThan(520);
  });

  it('returns null with < 50 m in window or absurd pace', () => {
    const still: TrackPoint[] = [pt(0, 38.7, -9.2), pt(45000, 38.7, -9.2)];
    expect(currentPaceSPerKm(still, 45000)).toBeNull();
    expect(currentPaceSPerKm([], 0)).toBeNull();
  });
});

describe('encodeTrack', () => {
  it('encodes and downsamples to ≤ 2000 points', () => {
    const many: TrackPoint[] = [];
    for (let i = 0; i < 5000; i++) many.push(pt(i * 1000, 38.7 + i * 0.00001, -9.2));
    const encoded = encodeTrack(many);
    expect(encoded.length).toBeGreaterThan(0);
    expect(polyline.decode(encoded).length).toBeLessThanOrEqual(2000);
  });
});
