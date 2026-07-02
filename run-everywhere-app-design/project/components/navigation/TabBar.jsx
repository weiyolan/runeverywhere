import React from "react";

/**
 * Run Everywhere — TabBar (bottom navigation)
 * 5-tab IA with a center Create (+) action. Locked: Explore · Runs · CREATE ·
 * Messages · Profile. Center button is Volt and floats slightly proud.
 * Pass icons (inline SVG / glyph) per item; the active tab tints Volt-on-ink.
 */
export function TabBar({
  items = [],          // [{ id, label, icon }] — 4 items; center create is separate
  value,
  onChange = () => {},
  onCreate = () => {},
  createLabel = "Create",
  style = {},
}) {
  // split into left 2 / right 2 around the center create button
  const left = items.slice(0, 2);
  const right = items.slice(2, 4);

  const bar = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "var(--tabbar-h)",
    background: "var(--ink-900)",
    padding: "0 8px",
    position: "relative",
    ...style,
  };

  const Tab = ({ it }) => {
    const active = it.id === value;
    return (
      <button onClick={() => onChange(it.id)} style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 3, border: "none", background: "transparent", cursor: "pointer",
        color: active ? "var(--volt)" : "var(--ink-400)", height: "100%", padding: "0 4px",
        transition: "color var(--dur-fast) var(--ease-out)",
      }}>
        <span style={{ display: "flex", width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>{it.icon}</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 10,
          textTransform: "uppercase", letterSpacing: ".06em" }}>{it.label}</span>
      </button>
    );
  };

  return (
    <nav style={bar}>
      <div style={{ display: "flex", flex: 1 }}>{left.map((it) => <Tab key={it.id} it={it} />)}</div>
      <button onClick={onCreate} aria-label={createLabel} style={{
        width: 56, height: 56, flex: "none", borderRadius: "var(--r-pill)",
        background: "var(--volt)", color: "var(--volt-ink)", border: "3px solid var(--ink-900)",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        marginTop: -18, boxShadow: "var(--shadow-volt)",
        fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 30, lineHeight: 1,
        transition: "transform var(--dur-fast) var(--ease-spring)",
      }}
      onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.92)"}
      onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>+</button>
      <div style={{ display: "flex", flex: 1 }}>{right.map((it) => <Tab key={it.id} it={it} />)}</div>
    </nav>
  );
}
