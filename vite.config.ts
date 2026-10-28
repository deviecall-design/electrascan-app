import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const devApiRoutes: Record<string, string> = {
  '/api/config': './api/config.js',
  '/api/detect': './api/detect.js',
  '/api/beta/rates': './api/beta/rates.js',
  '/api/beta/scans': './api/beta/scans.js',
  '/api/beta/estimates': './api/beta/estimates.js',
  '/api/beta/materials': './api/beta/materials.js',
  '/api/beta/settings': './api/beta/settings.js',
};

function devApiPlugin() {
  return {
    name: 'electrascan-dev-api',
    configureServer(server: { middlewares: { use: Function }; ssrLoadModule: (id: string) => Promise<{ default: Function }> }) {
      server.middlewares.use(async (req: any, res: any, next: Function) => {
        const pathname = (req.url || '').split('?')[0];
        const file = devApiRoutes[pathname];
        if (!file) return next();
        try {
          const raw = await new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            req.on('error', reject);
          });
          if (raw) {
            try { req.body = JSON.parse(raw); } catch { req.body = {}; }
          }
          req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
          const mod = await server.ssrLoadModule(path.resolve(__dirname, file));
          const adapter = {
            statusCode: 200,
            status(code: number) { this.statusCode = code; return this; },
            setHeader(name: string, value: string) { res.setHeader(name, value); return this; },
            json(body: unknown) {
              res.statusCode = this.statusCode;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(body));
            },
            send(body: unknown) {
              res.statusCode = this.statusCode;
              if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
              res.end(typeof body === 'string' ? body : JSON.stringify(body));
            },
          };
          await mod.default(req, adapter);
        } catch (err) {
          console.error('[ElectraScan] local API failed', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Local API failed.' }));
          }
        }
      });
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), tailwindcss(), devApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    target: "esnext"
  },
  esbuild: {
    supported: {
      'top-level-await': true //browsers can handle top-level-await features
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
    exclude: ['mupdf'] // Don't pre-bundle mupdf (WASM module)
  },
  worker: {
    format: 'es', // Use ES modules for workers
  },
  assetsInclude: ['**/*.wasm'], // Treat WASM as assets
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'supabase/functions/**'],
  },
});
