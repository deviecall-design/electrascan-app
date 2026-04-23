import React, { useState, createContext, useContext, useEffect, ReactNode } from 'react';

// ─── App Routes ─────────────────────────────────────────────
// Hash-backed routes so reload / browser-back work. Keeps the whole
// app mounted on a single HTML page (Vite SPA) with no framework dep.
export type AppRoute =
  | { name: 'dashboard' }
  | { name: 'projects' }
  | { name: 'project-detail'; id: string }
  | { name: 'rate-library' }
  | { name: 'reports' }
  | { name: 'email-inbox' };

type ViewMode = 'canvas' | 'estimates' | '3d';

interface RouterContextType {
  // Legacy takeoff view-mode switcher (kept for EstimatesView / 3D flows)
  viewMode: ViewMode;
  setViewMode: (viewMode: ViewMode) => void;

  // App-level route state (Dashboard / Projects / Project Detail)
  route: AppRoute;
  navigate: (r: AppRoute) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

// Serialise a route → URL hash so reload preserves state and deep-links work.
function routeToHash(r: AppRoute): string {
  if (r.name === 'dashboard') return '#/';
  if (r.name === 'projects') return '#/projects';
  if (r.name === 'rate-library') return '#/rate-library';
  if (r.name === 'reports') return '#/reports';
  if (r.name === 'email-inbox') return '#/email-inbox';
  return `#/projects/${r.id}`;
}

function hashToRoute(hash: string): AppRoute {
  const h = hash.replace(/^#\/?/, '');
  if (h === '' || h === '/') return { name: 'dashboard' };
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'projects') {
    if (parts[1]) return { name: 'project-detail', id: parts[1] };
    return { name: 'projects' };
  }
  if (parts[0] === 'rate-library') return { name: 'rate-library' };
  if (parts[0] === 'reports') return { name: 'reports' };
  if (parts[0] === 'email-inbox') return { name: 'email-inbox' };
  return { name: 'dashboard' };
}

export const RouterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window === 'undefined' ? { name: 'dashboard' } : hashToRoute(window.location.hash),
  );

  // Keep URL hash in sync with route changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const next = routeToHash(route);
    if (window.location.hash !== next) {
      window.history.pushState(null, '', next);
    }
  }, [route]);

  // Listen to back/forward navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => setRoute(hashToRoute(window.location.hash));
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const navigate = (r: AppRoute) => setRoute(r);

  return (
    <RouterContext.Provider value={{ viewMode, setViewMode, route, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useViewRouter = () => {
  const context = useContext(RouterContext);
  if (context === undefined) {
    throw new Error('useViewRouter must be used within a RouterProvider');
  }
  return context;
};

export const useAppRouter = () => {
  const context = useContext(RouterContext);
  if (context === undefined) {
    throw new Error('useAppRouter must be used within a RouterProvider');
  }
  return { route: context.route, navigate: context.navigate };
};
