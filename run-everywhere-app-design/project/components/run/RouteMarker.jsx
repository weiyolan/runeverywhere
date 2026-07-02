import React from "react";

/**
 * Run Everywhere — RouteMarker
 * Start/finish indicator for a route preview. "open" = point-to-point (start
 * flag), "closed" = loop (start = finish ring). Color-coded by run type.
 */
export function RouteMarker({ kind = "start", type = "discover", size = 28, css = {} }) {
  const TYPE_COLOR = { discover: "var(--discover)", challenge: "var(--challenge)", social: "var(--social)" };
  const color = TYPE_COLOR[type] || TYPE_COLOR.discover;

  const ring = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: size, height: size, borderRadius: "var(--r-pill)",
    border: `3px solid ${color}`, background: "var(--paper)", boxShadow: "var(--shadow-sm)", ...css,
  };

  if (kind === "closed") {
    // loop: ring with rotating arrow
    return (
      <span style={ring}>
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v5h-5"/>
        </svg>
      </span>
    );
  }
  if (kind === "finish") {
    return (
      <span style={{ ...ring, background: color }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24"><path d="M5 3v18M5 4h11l-2 4 2 4H5" fill="#fff" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/></svg>
      </span>
    );
  }
  // start: solid type dot
  return (
    <span style={{ ...ring, background: color, border: `3px solid var(--paper)`, boxShadow: "0 0 0 2px " + color + ", var(--shadow-sm)" }}>
      <span style={{ width: size * 0.28, height: size * 0.28, borderRadius: "var(--r-pill)", background: "#fff" }} />
    </span>
  );
}
