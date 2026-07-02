import React from "react";
import { MapCanvas } from "./MapCanvas.jsx";
import { MapPin } from "../../components/run/MapPin.jsx";
import { RunCard } from "../../components/run/RunCard.jsx";
import { IconButton } from "../../components/buttons/IconButton.jsx";
import { Tabs } from "../../components/navigation/Tabs.jsx";

const PINS = [
  { id: "r1", type: "discover",  label: "5K",  x: 60,  y: 250 },
  { id: "r2", type: "challenge", label: "10K", x: 210, y: 330 },
  { id: "r3", type: "social",    label: "6K",  x: 130, y: 470 },
  { id: "r4", type: "discover",  label: "8K",  x: 280, y: 250 },
  { id: "r5", type: "social",    label: "4K",  x: 300, y: 540 },
];

const SHEET = {
  r1: { type:"discover", title:"Sunrise Old-Town Loop", goal:"Easy social 5k to see the old town and the river path.", host:{name:"Maya Okafor",rating:4.9,verified:true}, distance:"5.2 km", pace:"5:30 /km", when:"Tomorrow · 07:00", city:"Alfama", spotsLeft:4, closedLoop:true, attendees:[{name:"T"},{name:"A"},{name:"J"},{name:"K"}] },
  r2: { type:"challenge", title:"Tempo Bridges 10K", goal:"Threshold session — 4:30 pace, no stopping.", host:{name:"Diego Sosa",rating:4.7}, distance:"10 km", pace:"4:30 /km", when:"Sat · 08:30", city:"Belém", spotsLeft:2, attendees:[{name:"R"},{name:"M"}] },
  r3: { type:"social", title:"Coffee & Cobblestones", goal:"Relaxed jog, long coffee after. New runners welcome.", host:{name:"Lena Brandt",rating:5.0,verified:true}, distance:"6 km", pace:"6:10 /km", when:"Sun · 09:00", city:"Príncipe Real", spotsLeft:5, closedLoop:true, attendees:[{name:"A"},{name:"B"},{name:"C"}] },
  r4: { type:"discover", title:"Miradouro Hunt", goal:"Hill route hitting the five best viewpoints.", host:{name:"Sofia Reis",rating:4.8}, distance:"8 km", pace:"5:50 /km", when:"Today · 18:30", city:"Graça", spotsLeft:3, attendees:[{name:"P"},{name:"Q"}] },
  r5: { type:"social", title:"Riverside Recovery", goal:"Flat, slow shake-out along the water.", host:{name:"Marco Pena",rating:4.6}, distance:"4 km", pace:"6:30 /km", when:"Mon · 07:15", city:"Cais do Sodré", spotsLeft:6, closedLoop:true, attendees:[{name:"D"},{name:"E"}] },
};

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "discover", label: "Discover" },
  { id: "challenge", label: "Challenge" },
  { id: "social", label: "Social" },
];

export function ExploreScreen({ onOpenRun = () => {}, onOpenFilters = () => {} }) {
  const [filter, setFilter] = React.useState("all");
  const [sel, setSel] = React.useState("r1");
  const pins = PINS.filter((p) => filter === "all" || p.type === filter);
  const sheet = SHEET[sel] || SHEET.r1;
  const accent = filter === "all" ? "var(--ink-900)" : `var(--${filter})`;

  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
      <MapCanvas />

      {/* top header overlay */}
      <div style={{ position: "absolute", top: 50, left: 0, right: 0, padding: "10px 16px 0", zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, height: 48, background: "var(--paper)",
            borderRadius: "var(--r-pill)", padding: "0 8px 0 16px", boxShadow: "var(--shadow-md)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05, flex: 1 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, textTransform: "uppercase", letterSpacing: ".02em" }}>Lisbon</span>
              <span style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 500 }}>{pins.length} runs near you</span>
            </div>
            <IconButton variant="ghost" size="sm" onClick={onOpenFilters} aria-label="Filters">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>
            </IconButton>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <Tabs variant="pill" value={filter} onChange={setFilter} accent={accent} items={TYPE_FILTERS} />
        </div>
      </div>

      {/* pins */}
      {pins.map((p) => (
        <button key={p.id} onClick={() => setSel(p.id)} style={{
          position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-100%)",
          background: "none", border: "none", padding: 0, cursor: "pointer", zIndex: p.id === sel ? 15 : 10,
        }}>
          <MapPin type={p.type} label={p.label} selected={p.id === sel} />
        </button>
      ))}

      {/* recenter */}
      <div style={{ position: "absolute", right: 16, bottom: 250, zIndex: 18 }}>
        <IconButton variant="surface" round aria-label="Recenter">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        </IconButton>
      </div>

      {/* bottom run sheet */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 25, padding: "0 14px 16px",
        background: "linear-gradient(to top, var(--paper-2) 60%, transparent)" }}>
        <div style={{ width: 38, height: 4, borderRadius: 3, background: "var(--ink-300)", margin: "0 auto 10px" }} />
        <RunCard {...sheet} variant="compact" onClick={() => onOpenRun(sel)} css={{ boxShadow: "var(--shadow-lg)" }} />
      </div>
    </div>
  );
}
