import React from "react";
import { MapCanvas } from "./MapCanvas.jsx";
import { RouteMarker } from "../../components/run/RouteMarker.jsx";
import { TypeChip } from "../../components/data/TypeChip.jsx";
import { Avatar } from "../../components/data/Avatar.jsx";
import { RatingStars } from "../../components/data/RatingStars.jsx";
import { StatBlock } from "../../components/data/StatBlock.jsx";
import { Badge } from "../../components/data/Badge.jsx";
import { Button } from "../../components/buttons/Button.jsx";
import { IconButton } from "../../components/buttons/IconButton.jsx";

const RUN = {
  type: "discover",
  title: "Sunrise Old-Town Loop",
  goal: "Easy social 5k to see the old town and the river path. We regroup at every miradouro — no one gets dropped. Coffee at the end for anyone who wants it.",
  host: { name: "Maya Okafor", rating: 4.9, verified: true, runs: 37 },
  city: "Alfama, Lisbon",
  when: "Tomorrow · 07:00",
  distance: "5.2", pace: "5:30", elev: "180",
  spotsLeft: 4, spotsTotal: 8, closedLoop: true,
  attendees: [{ name: "Tom R" }, { name: "Ana B" }, { name: "Jo K" }, { name: "Liv M" }],
};

export function RunDetailScreen({ onBack = () => {}, onJoin = () => {} }) {
  const [fav, setFav] = React.useState(false);
  const [requested, setRequested] = React.useState(false);
  const accent = `var(--${RUN.type})`;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper-2)" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 110 }}>
        {/* route map hero */}
        <div style={{ position: "relative", height: 320, flex: "none" }}>
          <MapCanvas>
            {/* route path */}
            <svg width="100%" height="100%" viewBox="0 0 390 320" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
              <path d="M95 240 C 60 170, 150 140, 180 120 S 300 110, 300 170 S 200 250, 150 235 S 110 250, 95 240"
                fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeOpacity="0.95" />
            </svg>
            <div style={{ position: "absolute", left: 95, top: 240, transform: "translate(-50%,-50%)" }}><RouteMarker kind="start" type={RUN.type} /></div>
            <div style={{ position: "absolute", left: 300, top: 170, transform: "translate(-50%,-50%)" }}><RouteMarker kind="closed" type={RUN.type} size={26} /></div>
          </MapCanvas>

          {/* top controls */}
          <div style={{ position: "absolute", top: 56, left: 16, right: 16, display: "flex", justifyContent: "space-between", zIndex: 10 }}>
            <IconButton variant="surface" round onClick={onBack} aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
            </IconButton>
            <div style={{ display: "flex", gap: 8 }}>
              <IconButton variant="surface" round active={fav} onClick={() => setFav(!fav)} aria-label="Favourite">
                <svg width="20" height="20" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.4"><path d="M20.8 8.6a5 5 0 0 0-8.8-3.1A5 5 0 0 0 3.2 8.6c0 4.4 8.8 10 8.8 10s8.8-5.6 8.8-10z"/></svg>
              </IconButton>
              <IconButton variant="surface" round aria-label="Share">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
              </IconButton>
            </div>
          </div>

          {/* loop badge */}
          <div style={{ position: "absolute", left: 16, bottom: 14, zIndex: 10, display: "flex", gap: 8 }}>
            <Badge tone="ink" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 4l3 3-3 3"/><path d="M7 20l-3-3 3-3"/><path d="M20 7H9a5 5 0 0 0-5 5M4 17h11a5 5 0 0 0 5-5"/></svg>}>Closed loop</Badge>
          </div>
        </div>

        {/* body */}
        <div style={{ padding: "18px 20px 0", marginTop: -4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <TypeChip type={RUN.type} />
            <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13, color: "var(--ink-400)" }}>{RUN.city}</span>
          </div>

          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 32, lineHeight: 1.04,
            textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--ink-900)" }}>{RUN.title}</h1>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12,
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, textTransform: "uppercase", color: accent }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            {RUN.when}
          </div>

          {/* stat strip */}
          <div style={{ display: "flex", gap: 8, background: "var(--ink-900)", borderRadius: "var(--r-md)",
            padding: "18px 12px", marginTop: 16 }}>
            <StatBlock value={RUN.distance} unit="km" label="Distance" accent="#fff" css={{ flex: 1 }} />
            <span style={{ width: 1, background: "var(--ink-700)" }} />
            <StatBlock value={RUN.pace} unit="/km" label="Pace" accent="#fff" css={{ flex: 1 }} />
            <span style={{ width: 1, background: "var(--ink-700)" }} />
            <StatBlock value={RUN.elev} unit="m" label="D+" accent="var(--volt)" css={{ flex: 1 }} />
          </div>

          {/* goal */}
          <div style={{ marginTop: 20 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-400)" }}>The goal</span>
            <p style={{ margin: "8px 0 0", fontSize: 15.5, lineHeight: 1.5, color: "var(--ink-700)", fontWeight: 400 }}>“{RUN.goal}”</p>
          </div>

          {/* host */}
          <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 13, padding: "14px",
            background: "var(--paper)", border: "1px solid var(--ink-200)", borderRadius: "var(--r-md)" }}>
            <Avatar name={RUN.host.name} size="lg" verified={RUN.host.verified} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, textTransform: "uppercase", color: "var(--ink-900)", lineHeight: 1 }}>{RUN.host.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-400)", fontWeight: 500, margin: "3px 0 5px" }}>Host · {RUN.host.runs} runs led</div>
              <RatingStars value={RUN.host.rating} count={42} size={14} showValue />
            </div>
            <IconButton variant="surface" aria-label="Message host">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </IconButton>
          </div>

          {/* who's joined */}
          <div style={{ marginTop: 22, display: "flex", alignItems: "center" }}>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-400)" }}>Who's running</span>
              <div style={{ display: "flex", marginTop: 10 }}>
                {RUN.attendees.map((a, i) => (
                  <span key={i} style={{ marginLeft: i ? -10 : 0, boxShadow: "0 0 0 2.5px var(--paper-2)", borderRadius: 99 }}>
                    <Avatar name={a.name} size="md" />
                  </span>
                ))}
                <span style={{ marginLeft: 12, alignSelf: "center", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 13, color: "var(--ink-500)" }}>
                  {RUN.attendees.length} going
                </span>
              </div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Badge tone="warn">{RUN.spotsLeft} spots left</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* sticky CTA */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 20px 30px",
        background: "var(--paper)", borderTop: "1px solid var(--ink-200)", boxShadow: "0 -6px 20px rgba(0,0,0,.06)" }}>
        <Button variant={requested ? "secondary" : "primary"} full size="lg"
          onClick={() => { setRequested(true); onJoin(); }}
          iconRight={requested ? null : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>}>
          {requested ? "Request sent ✓" : "Request to join"}
        </Button>
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11.5, color: "var(--ink-400)", fontWeight: 500 }}>
          {requested ? "Maya will confirm your spot soon" : "Approval required · host confirms your spot"}
        </div>
      </div>
    </div>
  );
}
