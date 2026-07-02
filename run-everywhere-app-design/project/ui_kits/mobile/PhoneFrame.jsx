import React from "react";

/**
 * PhoneFrame — 390-wide iPhone shell with status bar and home indicator.
 * Wraps each UI-kit screen so previews read as a real device.
 */
export function PhoneFrame({ children, dark = false, time = "7:24" }) {
  return (
    <div style={{
      width: 390, height: 844, position: "relative", flex: "none",
      background: dark ? "var(--ink-900)" : "var(--paper-2)",
      borderRadius: 44, overflow: "hidden",
      boxShadow: "var(--shadow-lg)", border: "1px solid var(--ink-200)",
      fontFamily: "var(--font-body)",
    }}>
      {/* status bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 50, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 26px", color: dark ? "#fff" : "var(--ink-900)", pointerEvents: "none",
      }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, letterSpacing: ".02em" }}>{time}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="4" width="3" height="8" rx="1"/><rect x="10" y="1" width="3" height="11" rx="1"/><rect x="15" y="1" width="3" height="11" rx="1" opacity="0.4"/></svg>
          <svg width="22" height="12" viewBox="0 0 22 12" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="1.5" width="17" height="9" rx="2.5"/><rect x="2.5" y="3" width="12" height="6" rx="1" fill="currentColor" stroke="none"/><rect x="19.5" y="4" width="1.5" height="4" rx="0.7" fill="currentColor" stroke="none"/></svg>
        </div>
      </div>
      {/* notch */}
      <div style={{ position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)",
        width: 122, height: 30, background: "var(--ink-900)", borderRadius: 18, zIndex: 60 }} />
      {/* screen content */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>{children}</div>
      {/* home indicator */}
      <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
        width: 134, height: 5, borderRadius: 3, background: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.35)", zIndex: 70 }} />
    </div>
  );
}
