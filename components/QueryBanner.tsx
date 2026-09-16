import React from "react";
import { C, FONT } from "./desktop/tokens";

/** Load / fetch-error chip. Never claims tables are missing. */
export default function QueryBanner({
  loading,
  error,
  noun,
}: {
  loading: boolean;
  error: boolean;
  noun: string;
}) {
  if (loading) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: 20,
          backgroundColor: C.bgSoft,
          color: C.textMuted,
          fontFamily: FONT.heading,
          fontSize: 11,
          fontWeight: 500,
          marginBottom: 16,
        }}
      >
        Loading {noun}…
      </div>
    );
  }
  if (error) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: 20,
          backgroundColor: C.amberSoft,
          color: C.amber,
          fontFamily: FONT.heading,
          fontSize: 11,
          fontWeight: 500,
          marginBottom: 16,
        }}
      >
        Could not load {noun}. Showing an empty list, not sample jobs.
      </div>
    );
  }
  return null;
}
