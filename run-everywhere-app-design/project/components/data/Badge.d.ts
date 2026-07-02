import React from "react";
export interface BadgeProps {
  children?: React.ReactNode;
  /** Color tone. */
  tone?: "neutral" | "ink" | "volt" | "go" | "warn" | "danger" | "star";
  icon?: React.ReactNode;
  solid?: boolean;
  css?: React.CSSProperties;
}
/** Small status/meta pill: spots left, FULL, LIVE, VERIFIED, +120 PTS. */
export function Badge(props: BadgeProps): JSX.Element;
