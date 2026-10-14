import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Fail the client build if a model key or an in-browser Anthropic client
// slips back into the bundle. The check looks at emitted output only and
// never prints the matched text.
function rejectClientSecretLeak(): Plugin {
  const leakedKey = /sk-ant-[A-Za-z0-9_-]{20,}/;
  return {
    name: 'reject-client-secret-leak',
    generateBundle(_options, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        const source = output.type === 'chunk'
          ? output.code
          : typeof output.source === 'string'
            ? output.source
            : '';
        if (!source) continue;
        if (leakedKey.test(source) || source.includes('dangerouslyAllowBrowser')) {
          this.error(`Refusing to emit ${fileName}: the client bundle must not call Anthropic or contain an API key.`);
        }
      }
    },
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), tailwindcss(), rejectClientSecretLeak()],
  // Hard-stop the historical client env name even if a future edit references it.
  define: {
    'import.meta.env.VITE_ANTHROPIC_API_KEY': 'undefined',
    'import.meta.env.NEXT_PUBLIC_ANTHROPIC_API_KEY': 'undefined',
  },
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
