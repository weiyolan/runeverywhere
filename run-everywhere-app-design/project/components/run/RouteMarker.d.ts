import React from "react";
export interface RouteMarkerProps {
  /** "start" point dot · "finish" flag · "closed" loop ring. */
  kind?: "start" | "finish" | "closed";
  type?: "discover" | "challenge" | "social";
  size?: number;
  css?: React.CSSProperties;
}
/** Start / finish / closed-loop indicator for route previews. */
export function RouteMarker(props: RouteMarkerProps): JSX.Element;
