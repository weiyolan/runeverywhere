import React from "react";
export interface StatBlockProps {
  value: React.ReactNode;
  label: string;
  unit?: string;
  /** Value color (e.g. a run-type or volt token). */
  accent?: string;
  align?: "center" | "left";
  size?: "sm" | "md" | "lg";
  css?: React.CSSProperties;
}
/** Big condensed metric + uppercase label — the KM / RUNS / D+ readouts. */
export function StatBlock(props: StatBlockProps): JSX.Element;
