import React from "react";
import { TypeChip } from "../data/TypeChip.jsx";
import { Avatar } from "../data/Avatar.jsx";
import { Badge } from "../data/Badge.jsx";

const TYPE_COLOR = {
  discover: "var(--discover)",
  challenge: "var(--challenge)",
  social: "var(--social)",
};

/**
 * Run Everywhere — RunCard
 * The core discovery object. A run, color-coded by type with a left accent rail.
 * Shows title, goal, host, key stats (distance / pace / when) and spots-left.
 * variant: "default" (list) | "compact" (map sheet / search) | "feature" (hero).
 */
export function RunCard({
  type = "discover",
  title = "",
  goal = "",
  host = {},                 // { name, src, rating, verified }
  distance = "",             // "5.2 km"
  pace = "",                 // "5:30 /km"
  when = "",                 // "Tomorrow · 07:00"
  city = "",
  spotsLeft = null,
  spotsTotal = null,
  closedLoop = false,
  attendees = [],            // [{name, src}]
  variant = "default",
  onClick,
  css = {},
}) {
  const accent = TYPE_COLOR[type] || TYPE_COLOR.discover;
  const compact = variant === "compact";
  const feature = variant === "feature";
  const full = spotsLeft != null && spotsLeft <= 0;

  const Stat = ({ icon, children }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
      fontFamily: "var(--font-display)", fontWeight: 700, fontSize: compact ? 13 : 14,
      color: "var(--ink-700)", textTransform: "uppercase", letterSpacing: ".02em" }}>
      <span style={{ color: accent, display: "flex" }}>{icon}</span>{children}
    </span>
  );

  return (
    <div onClick={onClick} style={{
      position: "relative", display: "flex", flexDirection: "column",
      background: "var(--paper)", borderRadius: "var(--r-md)", overflow: "hidden",
      border: "var(--bw-hair) solid var(--ink-200)",
      boxShadow: feature ? "var(--shadow-lg)" : "var(--shadow-sm)",
      cursor: onClick ? "pointer" : "default",
      transition: "transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
      ...css,
    }}
    onMouseEnter={onClick ? (e) => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; } : undefined}
    onMouseLeave={onClick ? (e) => { e.currentTarget.style.boxShadow = feature ? "var(--shadow-lg)" : "var(--shadow-sm)"; } : undefined}>
      {/* left accent rail */}
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: accent }} />

      <div style={{ padding: compact ? "13px 15px 13px 19px" : "16px 18px 16px 21px" }}>
        {/* header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: compact ? 8 : 10 }}>
          <TypeChip type={type} size={compact ? "sm" : "md"} />
          {city && <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, color: "var(--ink-400)" }}>{city}</span>}
          <span style={{ marginLeft: "auto" }}>
            {full
              ? <Badge tone="danger">Full</Badge>
              : spotsLeft != null && <Badge tone={spotsLeft <= 2 ? "warn" : "go"}>{spotsLeft} spots left</Badge>}
          </span>
        </div>

        {/* title */}
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800,
          fontSize: feature ? 26 : compact ? 19 : 22, lineHeight: 1.02, textTransform: "uppercase",
          letterSpacing: "var(--track-caps)", color: "var(--ink-900)" }}>{title}</div>

        {/* goal */}
        {goal && !compact && (
          <div style={{ fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 14,
            color: "var(--ink-500)", marginTop: 5, lineHeight: 1.35,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            “{goal}”
          </div>
        )}

        {/* stats */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: compact ? 12 : 16, marginTop: compact ? 10 : 13 }}>
          {distance && <Stat icon={<RouteGlyph/>}>{distance}</Stat>}
          {pace && <Stat icon={<SpeedGlyph/>}>{pace}</Stat>}
          {when && <Stat icon={<ClockGlyph/>}>{when}</Stat>}
        </div>

        {/* footer: host + attendees */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: compact ? 11 : 14,
          paddingTop: compact ? 11 : 13, borderTop: "var(--bw-hair) solid var(--ink-100)" }}>
          <Avatar name={host.name} src={host.src} size="sm" verified={host.verified} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13, color: "var(--ink-900)" }}>{host.name}</span>
            <span style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 11, color: "var(--ink-400)" }}>
              Host{host.rating ? ` · ${host.rating.toFixed(1)} ★` : ""}
            </span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            {attendees.slice(0, 3).map((a, i) => (
              <span key={i} style={{ marginLeft: i ? -8 : 0, borderRadius: "var(--r-pill)", boxShadow: "0 0 0 2px var(--paper)" }}>
                <Avatar name={a.name} src={a.src} size="xs" />
              </span>
            ))}
            {attendees.length > 3 && (
              <span style={{ marginLeft: -8, width: 28, height: 28, borderRadius: "var(--r-pill)",
                background: "var(--ink-900)", color: "var(--paper)", boxShadow: "0 0 0 2px var(--paper)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 11 }}>+{attendees.length - 3}</span>
            )}
            {closedLoop && (
              <span title="Closed loop" style={{ marginLeft: 10, color: accent, display: "flex" }}><LoopGlyph/></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* inline glyphs (stroke = currentColor) */
const RouteGlyph = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.2 18h6.3a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6H16"/></svg>);
const SpeedGlyph = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14l4-4"/><path d="M5 19a9 9 0 1 1 14 0"/></svg>);
const ClockGlyph = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
const LoopGlyph = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 4l3 3-3 3"/><path d="M7 20l-3-3 3-3"/><path d="M20 7H9a5 5 0 0 0-5 5M4 17h11a5 5 0 0 0 5-5"/></svg>);
