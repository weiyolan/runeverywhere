import React from "react";

export interface TabItem {
  id: string;
  label: string;
  /** Count badge (e.g. JOINED · 3). */
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange?: (id: string) => void;
  /** "underline" for section nav, "pill" for toggles. Default "underline". */
  variant?: "underline" | "pill";
  /** Active-state accent color — pass a run-type token to color by type. */
  accent?: string;
  /** Stretch tabs to fill width. Default true. */
  full?: boolean;
  style?: React.CSSProperties;
}

/**
 * Segmented section/tab control. Underline for ALL / MANAGED BY YOU / JOINED;
 * pill for map↔list and filter toggles.
 */
export function Tabs(props: TabsProps): JSX.Element;
