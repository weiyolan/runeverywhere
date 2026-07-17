import { describe, expect, it } from 'vitest';

import { detailsStepSchema, locationStepSchema, publishSchema } from '@/lib/validation/run';

const validDraft = {
  type: 'discover' as const,
  point: { lat: 38.7223, lng: -9.1393 },
  area_name: 'Alfama',
  city: 'Lisbon',
  country_code: 'PT',
  title: 'Old Town Loop',
  goal: 'Easy effort to see the old town.',
  distance_km: 7.5,
  max_group: 8,
  target_pace_s_per_km: 360,
  starts_at: new Date(Date.now() + 60 * 60 * 1000),
  closed_loop: true,
  visibility: 'approval' as const,
};

describe('locationStepSchema', () => {
  it('requires a point', () => {
    expect(locationStepSchema.safeParse({ ...validDraft, point: null }).success).toBe(false);
    expect(locationStepSchema.safeParse(validDraft).success).toBe(true);
  });
});

describe('detailsStepSchema (mirrors DB checks 1:1)', () => {
  it('accepts the valid draft', () => {
    expect(detailsStepSchema.safeParse(validDraft).success).toBe(true);
  });

  it.each([
    ['title empty', { title: '  ' }],
    ['title over 40', { title: 'x'.repeat(41) }],
    ['goal over 200', { goal: 'x'.repeat(201) }],
    ['distance below 1', { distance_km: 0.9 }],
    ['distance above 42', { distance_km: 42.1 }],
    ['distance sub-0.1 step', { distance_km: 5.25 }],
    ['max_group below 2', { max_group: 1 }],
    ['max_group above 30', { max_group: 31 }],
    ['max_group non-int', { max_group: 7.5 }],
    ['pace below 120', { target_pace_s_per_km: 119 }],
    ['pace above 720', { target_pace_s_per_km: 721 }],
    ['starts_at in the past', { starts_at: new Date(Date.now() - 1000) }],
    ['starts_at under 15 min out', { starts_at: new Date(Date.now() + 5 * 60 * 1000) }],
  ])('rejects %s', (_label, patch) => {
    expect(detailsStepSchema.safeParse({ ...validDraft, ...patch }).success).toBe(false);
  });

  it('allows null pace (NO TARGET) and trims title/goal', () => {
    const parsed = detailsStepSchema.parse({
      ...validDraft,
      target_pace_s_per_km: null,
      title: '  Old Town Loop  ',
      goal: '  coffee after  ',
    });
    expect(parsed.target_pace_s_per_km).toBeNull();
    expect(parsed.title).toBe('Old Town Loop');
    expect(parsed.goal).toBe('coffee after');
  });

  it('allows empty goal', () => {
    expect(detailsStepSchema.safeParse({ ...validDraft, goal: '' }).success).toBe(true);
  });
});

describe('publishSchema', () => {
  it('requires everything at once', () => {
    expect(publishSchema.safeParse(validDraft).success).toBe(true);
    expect(publishSchema.safeParse({ ...validDraft, point: null }).success).toBe(false);
    expect(publishSchema.safeParse({ ...validDraft, visibility: 'secret' }).success).toBe(false);
  });
});
