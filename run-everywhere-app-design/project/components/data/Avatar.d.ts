import React from "react";
export interface AvatarProps {
  src?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Verified runner tick (go-green). */
  verified?: boolean;
  /** Status ring: "volt" | "go" (online) | any color token. */
  ring?: string | null;
  css?: React.CSSProperties;
}
/** Runner avatar with initials fallback, verified tick, and optional status ring. */
export function Avatar(props: AvatarProps): JSX.Element;
