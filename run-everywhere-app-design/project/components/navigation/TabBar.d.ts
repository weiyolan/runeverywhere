import React from "react";

export interface TabBarItem {
  id: string;
  label: string;
  /** Inline SVG / glyph, ~24px. */
  icon: React.ReactNode;
}

export interface TabBarProps {
  /** Exactly 4 items — center Create (+) is rendered separately. */
  items: TabBarItem[];
  value: string;
  onChange?: (id: string) => void;
  /** Center Volt (+) handler. */
  onCreate?: () => void;
  createLabel?: string;
  style?: React.CSSProperties;
}

/**
 * Bottom navigation, locked IA: Explore · Runs · [Create +] · Messages · Profile.
 * Ink bar, Volt active glyph, floating Volt center create button.
 */
export function TabBar(props: TabBarProps): JSX.Element;
