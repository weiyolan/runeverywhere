/**
 * Create/edit-run validation (P2 G2) — mirrors the DB checks in
 * 0001_core.sql `runs` 1:1 so the wizard can never submit a row the
 * constraints would bounce.
 */
import { z } from 'zod';

const point = z.object({ lat: z.number(), lng: z.number() });

export const locationStepSchema = z.object({
  point,
  area_name: z.string(),
  city: z.string(),
  country_code: z.string(),
});

const MIN_LEAD_MS = 15 * 60 * 1000;

export const detailsStepSchema = z.object({
  title: z.string().trim().min(1, 'Give your run a name').max(40, 'Max 40 characters'),
  goal: z.string().trim().max(200, 'Max 200 characters'),
  distance_km: z
    .number()
    .min(1, 'At least 1 km')
    .max(42, 'At most 42 km')
    .multipleOf(0.1, 'Use 0.1 km steps'),
  max_group: z.number().int().min(2, 'At least 2 runners').max(30, 'At most 30 runners'),
  target_pace_s_per_km: z
    .number()
    .int()
    .min(120, 'Pace between 2:00 and 12:00 /km')
    .max(720, 'Pace between 2:00 and 12:00 /km')
    .nullable(),
  starts_at: z
    .date()
    .refine((d) => d.getTime() >= Date.now() + MIN_LEAD_MS, 'Start at least 15 minutes from now'),
  closed_loop: z.boolean(),
});

/**
 * Host edit (I2): same bounds, but no minimum-lead rule — a host must be able
 * to fix a typo minutes before the start. The lead rule re-applies only when
 * the start time itself changes (checked at the call site).
 */
export const editDetailsSchema = detailsStepSchema.omit({ starts_at: true }).extend({
  starts_at: z.date(),
});

export const publishSchema = locationStepSchema.merge(detailsStepSchema).extend({
  type: z.enum(['discover', 'challenge', 'social']),
  visibility: z.enum(['open', 'approval', 'invite']),
});

export type PublishDraft = z.infer<typeof publishSchema>;
