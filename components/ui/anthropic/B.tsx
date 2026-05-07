/**
 * B — inline emphasis for dark text + weight 500 inside an otherwise italic
 * Lora paragraph. Used heavily in Aries insight copy, dashboard greetings,
 * and alert banners ("3 items below 80% confidence").
 *
 * Key: `fontStyle: 'normal'` explicitly un-italicises when nested inside a
 * parent Lora-italic block.
 */

import React from "react";
import { C } from "../../desktop/tokens";

export default function B({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: C.text, fontWeight: 500, fontStyle: "normal" }}>
      {children}
    </span>
  );
}
