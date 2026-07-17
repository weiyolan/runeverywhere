/**
 * Pure display formatters (P2 D2). Deterministic, device-local.
 */
import { differenceInCalendarDays, format, isToday, isTomorrow } from 'date-fns';

/** "5:30 /km" */
export function formatPace(sPerKm: number): string {
  const m = Math.floor(sPerKm / 60);
  const s = Math.round(sPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

const trimKm = (km: number) => (km % 1 === 0 ? String(km) : km.toFixed(1));

/** "7.5 km" / "12 km" */
export const formatKm = (km: number) => `${trimKm(km)} km`;

/** Map-pin label: "7.5K" / "12K" */
export const formatPinLabel = (km: number) => `${trimKm(km)}K`;

/** "Today · 18:30" / "Tomorrow · 07:00" / "Sat · 08:00" / "12 Jul · 08:00" */
export function formatWhen(startsAt: string | Date): string {
  const d = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `Today · ${time}`;
  if (isTomorrow(d)) return `Tomorrow · ${time}`;
  if (differenceInCalendarDays(d, new Date()) < 7) return `${format(d, 'EEE')} · ${time}`;
  return `${format(d, 'd MMM')} · ${time}`;
}

/** "400 m away" / "2.1 km away" */
export function formatAway(m: number): string {
  return m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`;
}

/**
 * THE spots-left definition — host occupies a slot, matching join_run's
 * capacity check (`approved + 1 >= max_group` ⇔ full). No screen computes
 * this inline.
 */
export const spotsLeft = (maxGroup: number, approvedCount: number) =>
  maxGroup - 1 - approvedCount;
