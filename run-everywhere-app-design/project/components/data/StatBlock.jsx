import React from "react";

/**
 * Run Everywhere — StatBlock
 * Big condensed metric with an uppercase label. The KM / RUNS / D+ readouts on
 * profiles and recaps. Group several in a row; pass accent for the value color.
 */
export function StatBlock({ value, label, unit = "", accent = "var(--ink-900)", align = "center", size = "md", css = {} }) {
  const sizes = { sm: 26, md: 38, lg: 52 };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", gap: 2, ...css }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontFamily: "var(--font-metric)", fontWeight: 900, fontSize: sizes[size],
          lineHeight: 0.9, color: accent, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{value}</span>
        {unit && <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: sizes[size] * 0.4,
          color: "var(--ink-400)", textTransform: "uppercase" }}>{unit}</span>}
      </div>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11,
        textTransform: "uppercase", letterSpacing: "var(--track-label)", color: "var(--ink-400)" }}>{label}</span>
    </div>
  );
}
