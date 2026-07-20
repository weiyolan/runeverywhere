/**
 * Durable AsyncStorage sample buffer (P4 E3). Chunked so writes stay
 * O(batch); ~500 KB per 2 h @ 1 Hz — far under the Android budget.
 * ponytail: AsyncStorage chunks, no SQLite — swap if multi-hour ultras become a target.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TrackPoint, TrackState } from '@/lib/recording/geo';

const META_KEY = 're.live.meta';
const CHUNK_PREFIX = 're.live.chunk.';
const FLUSH_EVERY = 10;

export interface PauseInterval {
  from: number;
  to?: number;
}

export interface SessionMeta {
  runId: string;
  startedAt: number | null; // first accepted sample; null while acquiring
  state: 'recording' | 'paused';
  pauses: PauseInterval[];
  track: TrackState;
  movingMs: number;
  sampleCount: number;
  chunkCount: number;
}

let pending: TrackPoint[] = [];

export async function initSession(runId: string): Promise<SessionMeta> {
  const meta: SessionMeta = {
    runId,
    startedAt: null,
    state: 'recording',
    pauses: [],
    track: {
      lastAccepted: null,
      anchor: null,
      distanceM: 0,
      elevationM: 0,
      elevAnchor: null,
    },
    movingMs: 0,
    sampleCount: 0,
    chunkCount: 0,
  };
  pending = [];
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  return meta;
}

export async function readMeta(): Promise<SessionMeta | null> {
  const raw = await AsyncStorage.getItem(META_KEY);
  return raw ? (JSON.parse(raw) as SessionMeta) : null;
}

export async function writeMeta(meta: SessionMeta): Promise<void> {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

/** Append accepted samples; flushes a chunk every FLUSH_EVERY samples. */
export async function appendSamples(meta: SessionMeta, batch: TrackPoint[]): Promise<SessionMeta> {
  pending.push(...batch);
  let chunkCount = meta.chunkCount;
  while (pending.length >= FLUSH_EVERY) {
    const chunk = pending.splice(0, FLUSH_EVERY);
    await AsyncStorage.setItem(`${CHUNK_PREFIX}${chunkCount}`, JSON.stringify(chunk));
    chunkCount += 1;
  }
  return { ...meta, chunkCount, sampleCount: meta.sampleCount + batch.length };
}

/** Force out any partial chunk (finish/salvage path). */
export async function flush(meta: SessionMeta): Promise<SessionMeta> {
  if (pending.length === 0) return meta;
  const chunk = pending.splice(0, pending.length);
  await AsyncStorage.setItem(`${CHUNK_PREFIX}${meta.chunkCount}`, JSON.stringify(chunk));
  return { ...meta, chunkCount: meta.chunkCount + 1 };
}

export async function readAll(): Promise<{ meta: SessionMeta; samples: TrackPoint[] } | null> {
  const meta = await readMeta();
  if (!meta) return null;
  const samples: TrackPoint[] = [];
  for (let i = 0; i < meta.chunkCount; i++) {
    const raw = await AsyncStorage.getItem(`${CHUNK_PREFIX}${i}`);
    if (raw) samples.push(...(JSON.parse(raw) as TrackPoint[]));
  }
  samples.push(...pending);
  return { meta, samples };
}

export async function clear(): Promise<void> {
  const meta = await readMeta();
  const keys = [META_KEY];
  if (meta) {
    for (let i = 0; i <= meta.chunkCount; i++) keys.push(`${CHUNK_PREFIX}${i}`);
  }
  pending = [];
  await AsyncStorage.multiRemove(keys);
}
