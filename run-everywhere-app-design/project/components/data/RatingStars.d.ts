import React from "react";
export interface RatingStarsProps {
  value?: number;
  max?: number;
  size?: number;
  /** Review count shown as "(n)". */
  count?: number | null;
  /** Show the numeric average. */
  showValue?: boolean;
  /** Make interactive (review flow); called with 1..max. */
  onRate?: ((v: number) => void) | null;
  css?: React.CSSProperties;
}
/** Five-star rating with partial fill; interactive when onRate is set. */
export function RatingStars(props: RatingStarsProps): JSX.Element;
