import React from "react";

const TYPES = {
  discover:  { label: "Discover",  color: "var(--discover)",  soft: "var(--discover-soft)",  ink: "var(--discover-ink)" },
  challenge: { label: "Challenge", color: "var(--challenge)", soft: "var(--challenge-soft)", ink: "var(--challenge-ink)" },
  social:    { label: "Social",    color: "var(--social)",    soft: "var(--social-soft)",    ink: "var(--social-ink)" },
};

/**
 * Run Everywhere — TypeChip
 * The run-type label. Three locked types: discover / challenge / social.
 * "solid" (on cards/headers) or "soft" (inline, low-emphasis).
 */
export function TypeChip({ type = "discover", style = "solid", size = "md", custom, css = {} }) {
  const t = TYPES[type] || TYPES.discover;
  const label = custom || t.label;
  const small = size === "sm";

  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: small ? 22 : 26,
    padding: small ? "0 8px" : "0 11px",
    borderRadius: "var(--r-pill)",
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: small ? 11 : 12,
    textTransform: "uppercase",
    letterSpacing: "var(--track-caps)",
    lineHeight: 1,
    whiteSpace: "nowrap",
    ...(style === "solid"
      ? { background: t.color, color: t.ink }
      : { background: t.soft, color: t.color }),
    ...css,
  };
  return (
    <span style={base}>
      <span style={{ width: small ? 6 : 7, height: small ? 6 : 7, borderRadius: "var(--r-pill)",
        background: style === "solid" ? t.ink : t.color, opacity: style === "solid" ? 0.85 : 1 }} />
      {label}
    </span>
  );
}
