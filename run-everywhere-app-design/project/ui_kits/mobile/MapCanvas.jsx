import React from "react";

/**
 * MapCanvas — lightweight stylized light-map background (no tiles).
 * Streets, a river, parks and blocks rendered with CSS/SVG so screens read as
 * a city map. Children (pins, markers, routes) float on top.
 */
export function MapCanvas({ children, style = {} }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#EAEBE6", ...style }}>
      <svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
        {/* parks */}
        <rect x="-20" y="120" width="150" height="170" rx="18" fill="#D9E7C9" />
        <rect x="250" y="430" width="200" height="240" rx="20" fill="#D9E7C9" />
        {/* river */}
        <path d="M-20 560 C 120 520, 180 660, 410 600 L 410 844 L -20 844 Z" fill="#C7DCEC" />
        <path d="M-20 560 C 120 520, 180 660, 410 600" fill="none" stroke="#B4CFE3" strokeWidth="3" />
        {/* blocks */}
        {[[150,150],[210,150],[150,210],[40,330],[110,330],[180,330],[250,150],[300,210],[40,420],[110,420],[180,440],[280,330]].map(([x,y],i)=>(
          <rect key={i} x={x} y={y} width="46" height="46" rx="6" fill="#E0E1DB" />
        ))}
        {/* roads (casing + fill) */}
        {[
          "M0 110 H390","M0 300 H390","M0 410 H390","M0 510 H390",
          "M130 0 V844","M240 0 V844","M40 0 V300",
        ].map((d,i)=>(<g key={i}><path d={d} stroke="#fff" strokeWidth="14" /><path d={d} stroke="#F4F4F1" strokeWidth="10" /></g>))}
        {/* diagonal avenue */}
        <g><path d="M-10 740 L 410 250" stroke="#fff" strokeWidth="16" /><path d="M-10 740 L 410 250" stroke="#F4F4F1" strokeWidth="11" /></g>
      </svg>
      {children}
    </div>
  );
}
