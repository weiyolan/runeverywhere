import React from "react";

/**
 * Run Everywhere — Tabs
 * Horizontal segmented control. Two looks:
 *  - "underline" (ALL / MANAGED BY YOU / JOINED — section nav)
 *  - "pill" (filter / map-list toggle — ink pill slides under active)
 * Run-type tabs can color the active state per type via `accent`.
 */
export function Tabs({
  items = [],            // [{ id, label, count }]
  value,
  onChange = () => {},
  variant = "underline", // underline | pill
  accent = "var(--ink-900)",
  full = true,
  style = {},
}) {
  const isPill = variant === "pill";

  const bar = {
    display: "flex",
    gap: isPill ? 4 : 0,
    width: full ? "100%" : "auto",
    background: isPill ? "var(--paper-3)" : "transparent",
    borderRadius: isPill ? "var(--r-pill)" : 0,
    padding: isPill ? 4 : 0,
    borderBottom: isPill ? "none" : "var(--bw-mid) solid var(--ink-200)",
  };

  return (
    <div style={{ ...bar, ...style }}>
      {items.map((it) => {
        const active = it.id === value;
        const tab = {
          flex: full ? 1 : "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          cursor: "pointer",
          border: "none",
          background: isPill ? (active ? accent : "transparent") : "transparent",
          color: isPill
            ? (active ? "var(--paper)" : "var(--ink-500)")
            : (active ? "var(--ink-900)" : "var(--ink-400)"),
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "var(--track-caps)",
          height: isPill ? 40 : 46,
          borderRadius: isPill ? "var(--r-pill)" : 0,
          borderBottom: isPill ? "none" : `3px solid ${active ? accent : "transparent"}`,
          marginBottom: isPill ? 0 : -1.5,
          transition: "color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)",
          whiteSpace: "nowrap",
          padding: "0 12px",
        };
        return (
          <button key={it.id} style={tab} onClick={() => onChange(it.id)}>
            {it.label}
            {it.count != null && (
              <span style={{
                fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 11,
                background: active ? (isPill ? "rgba(255,255,255,.25)" : accent) : "var(--ink-200)",
                color: active ? (isPill ? "var(--paper)" : "var(--paper)") : "var(--ink-500)",
                borderRadius: "var(--r-pill)", padding: "1px 7px", lineHeight: 1.5,
              }}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
