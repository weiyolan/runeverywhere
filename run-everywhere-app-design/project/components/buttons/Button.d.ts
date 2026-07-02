import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Default "primary" (Volt). */
  variant?: "primary" | "secondary" | "ghost" | "danger" | "volt-outline";
  /** Control height. Default "md" (52px). */
  size?: "sm" | "md" | "lg";
  /** Corner style. Default "rounded". */
  shape?: "rounded" | "pill" | "square";
  /** Stretch to container width. */
  full?: boolean;
  /** Icon element rendered before the label. */
  iconLeft?: React.ReactNode;
  /** Icon element rendered after the label. */
  iconRight?: React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Primary action control for Run Everywhere. Volt for the single most important
 * action on a screen (Request to join, Publish, Start). Secondary (ink) for
 * confirmations, ghost for low-emphasis, danger for destructive.
 * Labels are ALWAYS short, uppercase, verb-first.
 */
export function Button(props: ButtonProps): JSX.Element;
