import React from "react";
import ScreenPlaceholder from "./ScreenPlaceholder";

export default function DashboardScreen() {
  return (
    <ScreenPlaceholder
      title="Dashboard"
      phase="Phase 2"
      description="Project pipeline overview: active/submitted/approved/completed projects, total pipeline value, recent activity, quick actions (new scan, open estimate, view variation)."
    />
  );
}
