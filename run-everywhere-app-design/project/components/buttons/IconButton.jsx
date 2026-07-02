import React from "react";

/**
 * Run Everywhere — IconButton
 * Square or circular icon-only control. Used for back, more, favourite, report,
 * and the floating map controls. Min 44px hit target.
 */
export function IconButton({
  children,
  variant = "surface",  // surface | ink | volt | ghost | danger
  size = "md",          // sm | md | lg
  round = false,
  active = false,
  disabled = false,
  style = {},
  ...rest
}) {
  const dims = { sm: 36, md: 44, lg: 52 };
  const d = dims[size];

  const variants = {
    surface: { background: "var(--paper)", color: "var(--ink-900)", border: "var(--bw-mid) solid var(--ink-200)", boxShadow: "var(--shadow-sm)" },
    ink: { background: "var(--ink-900)", color: "var(--paper)", border: "var(--bw-mid) solid var(--ink-900)" },
    volt: { background: "var(--volt)", color: "var(--volt-ink)", border: "var(--bw-mid) solid var(--volt)" },
    ghost: { background: "transparent", color: "var(--ink-900)", border: "var(--bw-mid) solid transparent" },
    danger: { background: "var(--danger-soft)", color: "var(--danger)", border: "var(--bw-mid) solid transparent" },
  };
  const v = variants[variant] || variants.surface;

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: d,
    height: d,
    borderRadius: round ? "var(--r-pill)" : "var(--r-sm)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: "transform var(--dur-fast) var(--ease-out)",
    flex: "none",
    ...v,
    ...(active ? { background: "var(--ink-900)", color: "var(--volt)", borderColor: "var(--ink-900)" } : {}),
    ...style,
  };
  const onDown = (e) => { if (!disabled) e.currentTarget.style.transform = "scale(var(--press-scale))"; };
  const onUp = (e) => { e.currentTarget.style.transform = "scale(1)"; };

  return (
    <button style={base} disabled={disabled} onMouseDown={onDown} onMouseUp={onUp} onMouseLeave={onUp} {...rest}>
      {children}
    </button>
  );
}
