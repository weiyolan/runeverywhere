import React from "react";
export interface TypeChipProps {
  /** Locked run type. */
  type?: "discover" | "challenge" | "social";
  /** "solid" on cards/headers, "soft" inline. Default "solid". */
  style?: "solid" | "soft";
  size?: "sm" | "md";
  /** Override label text (rarely needed). */
  custom?: string;
  css?: React.CSSProperties;
}
/** The run-type label pill. Three locked types only: discover / challenge / social. */
export function TypeChip(props: TypeChipProps): JSX.Element;
