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
 *   /estimate           — estimate list (GST-inclusive quoted totals)
 *   /estimate/new       — starts a scan (the live quote path)
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

import React, { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import DesktopShell from "./components/desktop/DesktopShell";
import JobFrame from "./components/desktop/JobFrame";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { authIsDisabled, loadAuthMode } from "./lib/authMode";

const LoginScreen = lazy(() => import("./components/LoginScreen"));
const DashboardScreen = lazy(() => import("./screens/DashboardScreen"));
const DetectionScreen = lazy(() => import("./screens/DetectionScreen"));
const ScanDetailScreen = lazy(() => import("./screens/ScanDetailScreen"));
const EstimateScreen = lazy(() => import("./screens/EstimateScreen"));
const PricingScheduleScreen = lazy(() => import("./screens/PricingScheduleScreen"));
const VariationReportScreen = lazy(() => import("./screens/VariationReportScreen"));
const ApprovalsScreen = lazy(() => import("./screens/ApprovalsScreen"));
const ReportsHome = lazy(() => import("./screens/ReportsHome"));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen"));
const JobsScreen = lazy(() => import("./screens/JobsScreen"));
const JobBurndownScreen = lazy(() => import("./screens/JobBurndownScreen"));
const SupplierPortal = lazy(() => import("./screens/SupplierPortal"));
const JobDocumentsTab = lazy(() => import("./screens/JobSections").then(mod => ({ default: mod.JobDocumentsTab })));
const JobEstimateTab = lazy(() => import("./screens/JobSections").then(mod => ({ default: mod.JobEstimateTab })));
const JobMilestonesTab = lazy(() => import("./screens/JobSections").then(mod => ({ default: mod.JobMilestonesTab })));
const JobScopeTab = lazy(() => import("./screens/JobSections").then(mod => ({ default: mod.JobScopeTab })));

function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ minHeight: 240, display: "grid", placeItems: "center", padding: 24, color: "#0f172a" }}
    >
      <p style={{ margin: 0, fontSize: 16 }}>Loading page</p>
    </div>
  );
}

function LazyOutlet() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}

function LoginGate() {
  if (authIsDisabled()) return <Navigate to="/dashboard" replace />;
  return <SignedInLoginGate />;
}

function SignedInLoginGate() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && session) navigate("/dashboard", { replace: true });
  }, [loading, session, navigate]);
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#475569" }}>
        Checking your session…
      </div>
    );
  }
  return <LoginScreen />;
}

export default function DesktopApp() {
  const [ready, setReady] = useState(import.meta.env.MODE === "test");
  useEffect(() => {
    if (ready) return;
    loadAuthMode().finally(() => setReady(true));
  }, [ready]);
  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#475569" }}>
        Opening Vesh Electrical…
      </div>
    );
  }
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Suspense fallback={<RouteFallback />}><LoginGate /></Suspense>} />
        <Route path="/supplier/:token" element={<Suspense fallback={<RouteFallback />}><SupplierPortal /></Suspense>} />
        <Route element={<DesktopShell />}>
          <Route element={<LazyOutlet />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/detection" element={<DetectionScreen />} />
            <Route path="/detection/:id" element={<ScanDetailScreen />} />
            <Route path="/estimate" element={<EstimateScreen />} />
            <Route path="/estimate/new" element={<Navigate to="/detection/new" replace />} />
            <Route path="/pricing-schedule" element={<PricingScheduleScreen />} />
            <Route path="/variation-report" element={<VariationReportScreen />} />
            <Route path="/approvals" element={<ApprovalsScreen />} />
            <Route path="/reports" element={<ReportsHome />} />
            <Route path="/projects" element={<Navigate to="/reports" replace />} />
            <Route path="/jobs" element={<JobsScreen />} />
            <Route path="/jobs/:jobKey" element={<JobFrame />}>
              <Route element={<LazyOutlet />}>
                <Route index element={<Navigate to="estimate" replace />} />
                <Route path="estimate" element={<JobEstimateTab />} />
                <Route path="scope" element={<JobScopeTab />} />
                <Route path="burndown" element={<JobBurndownScreen />} />
                <Route path="milestones" element={<JobMilestonesTab />} />
                <Route path="documents" element={<JobDocumentsTab />} />
              </Route>
            </Route>
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  );
}
