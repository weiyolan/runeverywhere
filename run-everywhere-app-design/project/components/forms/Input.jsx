import React from "react";

/**
 * Run Everywhere — Input / TextField
 * Bold structural field with an uppercase micro-label. Supports text, textarea,
 * leading adornment (icon/unit) and trailing adornment.
 */
export function Input({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  multiline = false,
  rows = 3,
  leading = null,
  trailing = null,
  hint = "",
  invalid = false,
  disabled = false,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const borderColor = invalid ? "var(--danger)" : focus ? "var(--ink-900)" : "var(--ink-200)";

  const wrap = {
    display: "flex",
    alignItems: multiline ? "flex-start" : "center",
    gap: "10px",
    background: disabled ? "var(--paper-3)" : "var(--paper)",
    border: `var(--bw-mid) solid ${borderColor}`,
    borderRadius: "var(--r-sm)",
    padding: multiline ? "12px 14px" : "0 14px",
    height: multiline ? "auto" : "var(--control-h)",
    transition: "border-color var(--dur-fast) var(--ease-out)",
  };
  const field = {
    border: "none",
    outline: "none",
    background: "transparent",
    width: "100%",
    fontFamily: "var(--font-body)",
    fontSize: "var(--t-md)",
    fontWeight: 500,
    color: "var(--text-primary)",
    resize: "none",
    padding: 0,
  };
  const labelStyle = {
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "var(--track-label)",
    color: "var(--ink-500)",
    marginBottom: "8px",
    display: "block",
  };

  return (
    <label style={{ display: "block", ...style }}>
      {label && <span style={labelStyle}>{label}</span>}
      <div style={wrap}>
        {leading}
        {multiline ? (
          <textarea style={field} rows={rows} value={value} onChange={onChange}
            placeholder={placeholder} disabled={disabled}
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...rest} />
        ) : (
          <input style={field} type={type} value={value} onChange={onChange}
            placeholder={placeholder} disabled={disabled}
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...rest} />
        )}
        {trailing}
      </div>
      {hint && (
        <span style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 500,
          color: invalid ? "var(--danger)" : "var(--ink-400)" }}>{hint}</span>
      )}
    </label>
  );
}
