/**
 * Card — white surface with 1px border and 10px radius. No drop shadow.
 * The single foundational container on every ElectraScan screen.
 */

import React from "react";
import { C, RADIUS } from "../../desktop/tokens";

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export default function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: RADIUS.lg,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
