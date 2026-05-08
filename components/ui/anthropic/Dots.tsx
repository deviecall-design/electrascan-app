/**
 * Dots — three animated "·" characters that fade in sequence. Used inline
 * after "Claude Vision analysing" to suggest continuous work during the
 * detection phase. Relies on the `es-dot` keyframes declared in index.css.
 */

import React from "react";

export default function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 2, marginLeft: 3 }}>
      <span style={{ animation: "es-dot 1.4s infinite", animationDelay: "0s" }}>·</span>
      <span style={{ animation: "es-dot 1.4s infinite", animationDelay: "0.2s" }}>·</span>
      <span style={{ animation: "es-dot 1.4s infinite", animationDelay: "0.4s" }}>·</span>
    </span>
  );
}
