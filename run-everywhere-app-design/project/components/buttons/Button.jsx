import React from "react";

/**
 * Run Everywhere — Button
 * High-contrast athletic CTA. Volt primary, ink secondary, ghost, and danger.
 * Condensed uppercase label, tight squared corners (or pill), snappy press.
 */
export function Button({
  children,
  variant = "primary",   // primary | secondary | ghost | danger | volt-outline
  size = "md",           // sm | md | lg
  shape = "rounded",     // rounded | pill | square
  full = false,
  iconLeft = null,
  iconRight = null,
  disabled = false,
  style = {},
  ...rest
}) {
  const heights = { sm: "var(--control-h-sm)", md: "var(--control-h)", lg: "56px" };
  const fonts = { sm: 13, md: 15, lg: 17 };
  const pads = { sm: "0 16px", md: "0 22px", lg: "0 28px" };
  const radii = {
    rounded: "var(--r-sm)",
    pill: "var(--r-pill)",
    square: "var(--r-xs)",
  };

  const variants = {
    primary: { background: "var(--action)", color: "var(--action-ink)", border: "var(--bw-bold) solid var(--action)" },
    secondary: { background: "var(--ink-900)", color: "var(--paper)", border: "var(--bw-bold) solid var(--ink-900)" },
    ghost: { background: "transparent", color: "var(--ink-900)", border: "var(--bw-bold) solid var(--ink-200)" },
    "volt-outline": { background: "transparent", color: "var(--ink-900)", border: "var(--bw-bold) solid var(--volt-press)" },
    danger: { background: "var(--danger)", color: "#fff", border: "var(--bw-bold) solid var(--danger)" },
  };

  const v = variants[variant] || variants.primary;

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: full ? "100%" : "auto",
    height: heights[size],
    padding: pads[size],
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: fonts[size],
    textTransform: "uppercase",
    letterSpacing: "var(--track-caps)",
    lineHeight: 1,
    borderRadius: radii[shape],
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: "transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
    userSelect: "none",
    whiteSpace: "nowrap",
    ...v,
    ...style,
  };

  const onDown = (e) => { if (!disabled) e.currentTarget.style.transform = "scale(var(--press-scale))"; };
  const onUp = (e) => { e.currentTarget.style.transform = "scale(1)"; };

  return (
    <button style={base} disabled={disabled} onMouseDown={onDown} onMouseUp={onUp} onMouseLeave={onUp} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
