import React from "react";
import { RunCard } from "../../components/run/RunCard.jsx";
import { Tabs } from "../../components/navigation/Tabs.jsx";
import { Badge } from "../../components/data/Badge.jsx";

const RUNS = [
  { key:"a", tab:"mine", data:{ type:"discover", title:"Sunrise Old-Town Loop", goal:"Easy social 5k to see the old town and the river path.", host:{name:"You",rating:4.9,verified:true}, distance:"5.2 km", pace:"5:30 /km", when:"Tomorrow · 07:00", city:"Alfama", spotsLeft:4, closedLoop:true, attendees:[{name:"T"},{name:"A"},{name:"J"},{name:"K"}] }, requests:2 },
  { key:"b", tab:"mine", data:{ type:"challenge", title:"Wednesday Track Intervals", goal:"8×400m at 5k pace. Bring water.", host:{name:"You",rating:4.9,verified:true}, distance:"7 km", pace:"4:10 /km", when:"Wed · 19:00", city:"Estádio", spotsLeft:0, attendees:[{name:"R"},{name:"M"},{name:"P"},{name:"L"},{name:"S"}] } },
  { key:"c", tab:"joined", data:{ type:"social", title:"Coffee & Cobblestones", goal:"Relaxed jog, long coffee after.", host:{name:"Lena Brandt",rating:5.0,verified:true}, distance:"6 km", pace:"6:10 /km", when:"Sun · 09:00", city:"Príncipe Real", spotsLeft:5, closedLoop:true, attendees:[{name:"A"},{name:"B"},{name:"C"}] } },
  { key:"d", tab:"joined", data:{ type:"challenge", title:"Tempo Bridges 10K", goal:"Threshold session — 4:30 pace, no stopping.", host:{name:"Diego Sosa",rating:4.7}, distance:"10 km", pace:"4:30 /km", when:"Sat · 08:30", city:"Belém", spotsLeft:2, attendees:[{name:"R"},{name:"M"}] } },
];

export function RunsScreen({ onOpenRun = () => {} }) {
  const [tab, setTab] = React.useState("all");
  const mine = RUNS.filter((r) => r.tab === "mine");
  const joined = RUNS.filter((r) => r.tab === "joined");
  const visible = tab === "all" ? RUNS : RUNS.filter((r) => r.tab === tab);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper-2)" }}>
      {/* header */}
      <div style={{ padding: "60px 20px 0" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, textTransform: "uppercase",
          letterSpacing: ".1em", color: "var(--ink-400)" }}>Your runs</span>
        <h1 style={{ margin: "2px 0 14px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 38,
          textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 0.95, color: "var(--ink-900)" }}>
          7 days, 3 runs
        </h1>
        <Tabs value={tab} onChange={setTab} items={[
          { id: "all", label: "All", count: RUNS.length },
          { id: "mine", label: "Managed", count: mine.length },
          { id: "joined", label: "Joined", count: joined.length },
        ]} />
      </div>

      {/* list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 96px", display: "flex", flexDirection: "column", gap: 14 }}>
        {visible.map((r) => (
          <div key={r.key} style={{ position: "relative" }}>
            {r.requests ? (
              <div style={{ position: "absolute", top: -7, right: 8, zIndex: 5 }}>
                <Badge tone="volt" icon={<span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--volt-ink)" }} />}>{r.requests} requests</Badge>
              </div>
            ) : null}
            <RunCard {...r.data} onClick={() => onOpenRun(r.key)} />
          </div>
        ))}
      </div>
    </div>
  );
}
