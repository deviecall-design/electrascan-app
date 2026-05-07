import './mupdfConfig'; // MUST be the first import to configure WASM path before MuPDF loads

import React from 'react';
import ReactDOM from 'react-dom/client';
import DesktopApp from './DesktopApp';
import { ToastProvider } from './contexts/ToastContext';
import { LicenseProvider } from './contexts/LicenseContext';
import { suppressConsoleWarnings } from './utils/suppressWarnings';
import { RouterProvider } from './components/Router';

// Suppress specific PDF.js warnings to prevent performance issues
suppressConsoleWarnings();

// NOTE: The mobile App.tsx is intentionally no longer mounted. It remains in
// the repo as reference during the desktop rewrite — once Phase 2-5 are
// complete and the desktop flows reach parity, App.tsx can be deleted.
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <LicenseProvider>
        <RouterProvider>
          <DesktopApp />
        </RouterProvider>
      </LicenseProvider>
    </ToastProvider>
  </React.StrictMode>
);