import React from "react";
import { Avatar } from "../../components/data/Avatar.jsx";
import { RatingStars } from "../../components/data/RatingStars.jsx";
import { StatBlock } from "../../components/data/StatBlock.jsx";
import { TypeChip } from "../../components/data/TypeChip.jsx";
import { Badge } from "../../components/data/Badge.jsx";
import { Button } from "../../components/buttons/Button.jsx";
import { IconButton } from "../../components/buttons/IconButton.jsx";

const REVIEWS = [
  { name: "Diego Sosa", rating: 5, type: "challenge", text: "Strong, steady pacing and great energy on the climbs. Would run with again.", when: "2d ago" },
  { name: "Lena Brandt", rating: 5, type: "social", text: "Super welcoming to a newcomer in the city — showed me all the best spots.", when: "1w ago" },
];

export function ProfileScreen({ onEdit = () => {}, self = true }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper-2)" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 96 }}>
        {/* ink header */}
        <div style={{ background: "var(--ink-900)", padding: "58px 20px 26px", position: "relative" }}>
          <div style={{ position: "absolute", top: 56, right: 16, display: "flex", gap: 8 }}>
            <IconButton variant="ghost" round aria-label="Settings" style={{ color: "#fff", borderColor: "var(--ink-700)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6.7 19.3a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7 2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6V4a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>
            </IconButton>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar name="Maya Okafor" size="xl" verified ring="volt" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, textTransform: "uppercase", color: "#fff", lineHeight: 1.04 }}>Maya Okafor</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
                <RatingStars value={4.9} size={15} showValue css={{ color: "#fff" }} />
                <span style={{ fontSize: 12, color: "var(--ink-300)", fontWeight: 500 }}>· 42 reviews</span>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Badge tone="go">Verified</Badge>
                <Badge tone="volt">Level 6</Badge>
              </div>
            </div>
          </div>

          <p style={{ margin: "16px 0 0", color: "var(--ink-300)", fontSize: 14, lineHeight: 1.5, fontWeight: 400 }}>
            Marathoner, map-collector. Home base Lisbon — happy to show visitors the hilly bits. Speaks EN / PT / FR.
          </p>

          {/* stat strip */}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <StatBlock value="842" label="Km" accent="#fff" css={{ flex: 1 }} />
            <span style={{ width: 1, background: "var(--ink-700)" }} />
            <StatBlock value="37" label="Runs" accent="#fff" css={{ flex: 1 }} />
            <span style={{ width: 1, background: "var(--ink-700)" }} />
            <StatBlock value="9.6k" unit="m" label="D+" accent="var(--volt)" css={{ flex: 1 }} />
          </div>
        </div>

        {/* action row */}
        <div style={{ padding: "16px 20px 0", display: "flex", gap: 10 }}>
          {self
            ? <Button variant="secondary" full onClick={onEdit}>Edit profile</Button>
            : <><Button variant="primary" full>Follow</Button><Button variant="ghost" full>Message</Button></>}
        </div>

        {/* favourite routes */}
        <div style={{ padding: "22px 20px 0" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-400)" }}>Usual runs</span>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <TypeChip type="discover" /><TypeChip type="challenge" /><TypeChip type="social" style="soft" />
          </div>
        </div>

        {/* reviews */}
        <div style={{ padding: "22px 20px 0" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-400)" }}>Other runners say</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            {REVIEWS.map((r, i) => (
              <div key={i} style={{ background: "var(--paper)", border: "1px solid var(--ink-200)", borderRadius: "var(--r-md)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={r.name} size="sm" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, textTransform: "uppercase", color: "var(--ink-900)", lineHeight: 1 }}>{r.name}</div>
                    <span style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 500 }}>{r.when}</span>
                  </div>
                  <RatingStars value={r.rating} size={13} />
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.45, color: "var(--ink-700)" }}>{r.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* report */}
        {!self && (
          <div style={{ padding: "18px 20px 0", textAlign: "center" }}>
            <button style={{ background: "none", border: "none", color: "var(--ink-400)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", cursor: "pointer" }}>Report runner</button>
          </div>
        )}
      </div>
    </div>
  );
}
