import React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Default "surface" (floats over map/content). */
  variant?: "surface" | "ink" | "volt" | "ghost" | "danger";
  /** Square size. Default "md" (44px hit target). */
  size?: "sm" | "md" | "lg";
  /** Circular instead of squared. */
  round?: boolean;
  /** Toggled-on state (ink fill, volt glyph). */
  active?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Icon-only control: back, more, favourite, report, map zoom/recenter.
 * Pass an inline SVG or icon-font glyph as children. Never smaller than 44px
 * for primary touch targets.
 */
export function IconButton(props: IconButtonProps): JSX.Element;
