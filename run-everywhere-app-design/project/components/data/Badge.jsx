import React from "react";

const TONES = {
  neutral: { bg: "var(--ink-100)", fg: "var(--ink-700)" },
  ink:     { bg: "var(--ink-900)", fg: "var(--paper)" },
  volt:    { bg: "var(--volt)",    fg: "var(--volt-ink)" },
  go:      { bg: "var(--go-soft)", fg: "var(--go)" },
  warn:    { bg: "var(--warn-soft)", fg: "#9A6A00" },
  danger:  { bg: "var(--danger-soft)", fg: "var(--danger)" },
  star:    { bg: "var(--star)", fg: "var(--ink-900)" },
};

/**
 * Run Everywhere — Badge
 * Small status/meta pill: "4 SPOTS LEFT", "FULL", "LIVE", "VERIFIED", "+120 PTS".
 * Tone sets the color; pass an icon/dot via `icon`.
 */
export function Badge({ children, tone = "neutral", icon = null, solid = false, css = {} }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      height: 22, padding: "0 9px", borderRadius: "var(--r-pill)",
      background: t.bg, color: t.fg,
      fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 11,
      textTransform: "uppercase", letterSpacing: "var(--track-caps)", lineHeight: 1, whiteSpace: "nowrap",
      ...css,
    }}>
      {icon}
      {children}
    </span>
  );
}
