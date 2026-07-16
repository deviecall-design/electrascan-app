import './mupdfConfig'; // MUST be the first import to configure WASM path before MuPDF loads

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './contexts/ToastContext';
import { LicenseProvider } from './contexts/LicenseContext';
import { TenantProvider } from './contexts/TenantContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { RateLibraryProvider } from './contexts/RateLibraryContext';
import { suppressConsoleWarnings } from './utils/suppressWarnings';
import { RouterProvider } from './components/Router';
import { AuthProvider } from './contexts/AuthContext';

// Suppress specific PDF.js warnings to prevent performance issues
suppressConsoleWarnings();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
    <ToastProvider>
      <LicenseProvider>
        <TenantProvider>
          <ProjectProvider>
            <RateLibraryProvider>
              <RouterProvider>
                <App />
              </RouterProvider>
            </RateLibraryProvider>
          </ProjectProvider>
        </TenantProvider>
      </LicenseProvider>
    </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);