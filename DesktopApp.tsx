/**
 * DesktopApp — root component for the ElectraScan desktop workflow.
 *
 * Replaces the mobile-first App.tsx as the primary entry point. Mobile screens
 * remain in App.tsx as a reference archive during the transition but are no
 * longer mounted by index.tsx.
 *
 * Routing: react-router-dom v6. Deep links supported for every section so
 * builders/architects can be emailed direct links to a project, estimate,
 * or approval envelope.
 *
 *   /dashboard          — project pipeline overview
 *   /detection          — upload + AI scan + review detected components
 *   /estimate           — build / edit / lock estimates
 *   /pricing-schedule   — per-tenant rate library
 *   /variation-report   — scan → diff against prior estimate
 *   /approvals          — DocuSign multi-party signing workflow
 *
 * Justification for adding react-router-dom (per the no-new-packages rule):
 * six screens with stateful sub-routes (project IDs, envelope IDs) make
 * hand-rolled routing fragile. react-router-dom is the standard React
 * routing library, ~10KB gzipped, and gives us the browser back button,
 * bookmarkable URLs, and typed params for free.
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DesktopShell from "./components/desktop/DesktopShell";
import DashboardScreen from "./screens/DashboardScreen";
import DetectionScreen from "./screens/DetectionScreen";
import EstimateScreen from "./screens/EstimateScreen";
import PricingScheduleScreen from "./screens/PricingScheduleScreen";
import VariationReportScreen from "./screens/VariationReportScreen";
import ApprovalsScreen from "./screens/ApprovalsScreen";
import SettingsScreen from "./screens/SettingsScreen";

export default function DesktopApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DesktopShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"         element={<DashboardScreen />} />
          <Route path="/detection"         element={<DetectionScreen />} />
          <Route path="/estimate"          element={<EstimateScreen />} />
          <Route path="/pricing-schedule"  element={<PricingScheduleScreen />} />
          <Route path="/variation-report"  element={<VariationReportScreen />} />
          <Route path="/approvals"         element={<ApprovalsScreen />} />
          <Route path="/settings"          element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
