/**
 * Feature flags — P6.1 replaces this constant with the `feature_flags` table
 * + realtime-refreshed hook. Until then every integration/monetization
 * surface renders its flags-off state (P6 DoD #3).
 */
export const FLAGS = {
  healthkit: false,
  strava: false,
  garmin: false,
  monetization: false,
} as const;

export type FlagKey = keyof typeof FLAGS;
