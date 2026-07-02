import React from "react";

const TYPE_COLOR = {
  discover: "var(--discover)",
  challenge: "var(--challenge)",
  social: "var(--social)",
};

/**
 * Run Everywhere — MapPin
 * Teardrop map pin, color-coded by run type. Shows distance or a glyph, can be
 * "selected" (larger, ink ring) or a small "cluster" count. Floats over the map.
 */
export function MapPin({
  type = "discover",
  label = "",          // e.g. "5K" or count
  selected = false,
  cluster = false,
  css = {},
  ...rest
}) {
  const color = TYPE_COLOR[type] || TYPE_COLOR.discover;
  const size = selected ? 52 : 40;

  if (cluster) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 38, height: 38, borderRadius: "var(--r-pill)", background: "var(--ink-900)",
        color: "var(--paper)", border: "2.5px solid var(--paper)", boxShadow: "var(--shadow-pin)",
        fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 15, ...css }} {...rest}>{label}</span>
    );
  }

  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size * 1.2,
      filter: "drop-shadow(var(--shadow-pin))", ...css }} {...rest}>
      <svg width={size} height={size * 1.2} viewBox="0 0 40 48" style={{ position: "absolute", inset: 0 }}>
        <path d="M20 1C9.5 1 1 9.3 1 19.6 1 32 20 47 20 47s19-15 19-27.4C39 9.3 30.5 1 20 1z"
          fill={color} stroke={selected ? "var(--ink-900)" : "var(--paper)"} strokeWidth={selected ? 3 : 2.5} />
        <circle cx="20" cy="19" r="11" fill="rgba(255,255,255,0.18)" />
      </svg>
      <span style={{ position: "absolute", top: size * 0.40, left: 0, right: 0, textAlign: "center",
        transform: "translateY(-50%)", color: "#fff",
        fontFamily: "var(--font-display)", fontWeight: 900, fontSize: selected ? 15 : 12,
        textTransform: "uppercase", letterSpacing: ".02em", lineHeight: 1 }}>{label}</span>
    </span>
  );
}
