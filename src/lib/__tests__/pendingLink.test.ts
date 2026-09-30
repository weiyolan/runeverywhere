import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));

const { consumePendingLink, savePendingLink } = await import('@/lib/pendingLink');

describe('pendingLink', () => {
  beforeEach(() => store.clear());

  it('replays a fresh link once', async () => {
    await savePendingLink('/invite/DEVLINK01', 0);
    expect(await consumePendingLink(60_000)).toBe('/invite/DEVLINK01');
    expect(await consumePendingLink(60_000)).toBeNull();
  });

  it('drops links older than 30 minutes', async () => {
    await savePendingLink('/run/abc', 0);
    expect(await consumePendingLink(31 * 60_000)).toBeNull();
  });

  it('ignores garbage', async () => {
    store.set('pendingLink', 'not json');
    expect(await consumePendingLink()).toBeNull();
  });
});
