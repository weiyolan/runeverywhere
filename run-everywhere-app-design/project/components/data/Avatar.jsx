import React from "react";

/**
 * Run Everywhere — Avatar
 * Runner photo with optional verified tick and live/online ring. Falls back to
 * initials on Volt. Sizes from xs (list) to xl (profile header).
 */
export function Avatar({
  src,
  name = "",
  size = "md",       // xs | sm | md | lg | xl
  verified = false,
  ring = null,       // null | "volt" | "go" (online) | run-type token color
  css = {},
}) {
  const dims = { xs: 28, sm: 36, md: 44, lg: 64, xl: 96 };
  const d = dims[size] || 44;
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const ringColor = ring === "volt" ? "var(--volt)" : ring === "go" ? "var(--go)" : ring;

  return (
    <span style={{ position: "relative", display: "inline-flex", flex: "none", ...css }}>
      <span style={{
        width: d, height: d, borderRadius: "var(--r-pill)", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--volt)", color: "var(--volt-ink)",
        fontFamily: "var(--font-display)", fontWeight: 900, fontSize: d * 0.38,
        border: ringColor ? `2.5px solid ${ringColor}` : "none",
        boxShadow: ringColor ? "0 0 0 2px var(--paper)" : "none",
      }}>
        {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
      </span>
      {verified && (
        <span style={{
          position: "absolute", right: -2, bottom: -2,
          width: d * 0.34, height: d * 0.34, minWidth: 16, minHeight: 16,
          borderRadius: "var(--r-pill)", background: "var(--go)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid var(--paper)", fontSize: d * 0.2,
        }}>
          <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
      )}
    </span>
  );
}
