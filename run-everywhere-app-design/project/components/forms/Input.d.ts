import React from "react";

export interface InputProps {
  /** Uppercase micro-label above the field. */
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  type?: string;
  /** Render a textarea instead of a single line. */
  multiline?: boolean;
  rows?: number;
  /** Leading adornment (icon or unit). */
  leading?: React.ReactNode;
  /** Trailing adornment (icon, unit, clear). */
  trailing?: React.ReactNode;
  /** Helper / error text below. */
  hint?: string;
  invalid?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/**
 * Text field with uppercase micro-label. Use for create-run forms, search,
 * profile editing, and the free-text run goal (multiline).
 */
export function Input(props: InputProps): JSX.Element;
