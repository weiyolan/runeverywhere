import React from "react";
export interface MapPinProps {
  type?: "discover" | "challenge" | "social";
  /** Text inside the pin — distance ("5K") or, for clusters, a count. */
  label?: string;
  /** Enlarged + ink ring when tapped. */
  selected?: boolean;
  /** Render as a dark count bubble instead of a teardrop. */
  cluster?: boolean;
  css?: React.CSSProperties;
}
/** Teardrop map pin, color-coded by run type; floats over the Explore map. */
export function MapPin(props: MapPinProps): JSX.Element;
