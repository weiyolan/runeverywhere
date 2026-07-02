import React from "react";

export interface RunHost {
  name: string;
  src?: string;
  rating?: number;
  verified?: boolean;
}
export interface RunAttendee { name: string; src?: string; }

export interface RunCardProps {
  /** Locked run type — sets the accent rail & chip. */
  type?: "discover" | "challenge" | "social";
  title: string;
  /** Free-text run goal, shown quoted (hidden in compact). */
  goal?: string;
  host?: RunHost;
  /** e.g. "5.2 km" */
  distance?: string;
  /** e.g. "5:30 /km" */
  pace?: string;
  /** e.g. "Tomorrow · 07:00" */
  when?: string;
  city?: string;
  /** Remaining spots; 0 or less renders FULL. */
  spotsLeft?: number | null;
  spotsTotal?: number | null;
  /** Closed loop vs point-to-point. */
  closedLoop?: boolean;
  attendees?: RunAttendee[];
  /** "default" list · "compact" map sheet/search · "feature" hero. */
  variant?: "default" | "compact" | "feature";
  onClick?: () => void;
  css?: React.CSSProperties;
}

/**
 * The core discovery object: a planned run, color-coded by type with a left
 * accent rail, goal quote, key stats and host/attendee strip. Tapping opens the
 * Run detail page. Use across Explore list, Your Runs, search, and map sheets.
 *
 * @startingPoint section="Run" subtitle="Color-coded run card — the core object" viewport="360x230"
 */
export function RunCard(props: RunCardProps): JSX.Element;
