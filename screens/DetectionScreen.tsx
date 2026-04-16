import React from "react";
import ScreenPlaceholder from "./ScreenPlaceholder";

export default function DetectionScreen() {
  return (
    <ScreenPlaceholder
      title="Detection"
      phase="Phase 3"
      description="Upload an electrical PDF → AI reads the legend and scans every room → review detected components by room with confidence scores and risk flags → confirm or adjust before building the estimate."
    />
  );
}
