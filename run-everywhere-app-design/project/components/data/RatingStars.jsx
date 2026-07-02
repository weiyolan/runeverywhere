import React from "react";

/**
 * Run Everywhere — RatingStars
 * Five-star runner rating. Shows partial fill for the average, optional numeric
 * value and review count. Interactive when onRate is provided (review flow).
 */
export function RatingStars({ value = 0, max = 5, size = 16, count = null, showValue = false, onRate = null, css = {} }) {
  const Star = ({ fill, idx }) => (
    <span
      onClick={onRate ? () => onRate(idx + 1) : undefined}
      style={{ position: "relative", width: size, height: size, display: "inline-block",
        cursor: onRate ? "pointer" : "default", lineHeight: 0 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", inset: 0 }}>
        <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.6 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"
          fill="var(--ink-200)" />
      </svg>
      <span style={{ position: "absolute", inset: 0, width: `${Math.max(0, Math.min(1, fill)) * 100}%`, overflow: "hidden" }}>
        <svg width={size} height={size} viewBox="0 0 24 24">
          <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.6 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"
            fill="var(--star)" />
        </svg>
      </span>
    </span>
  );

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...css }}>
      <span style={{ display: "inline-flex", gap: 2 }}>
        {Array.from({ length: max }).map((_, i) => <Star key={i} idx={i} fill={value - i} />)}
      </span>
      {showValue && (
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: size * 0.9,
          color: "var(--ink-900)", lineHeight: 1 }}>{value.toFixed(1)}</span>
      )}
      {count != null && (
        <span style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 12, color: "var(--ink-400)" }}>
          ({count})
        </span>
      )}
    </span>
  );
}
