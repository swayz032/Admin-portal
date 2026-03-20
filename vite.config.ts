import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import pkg from "./package.json";

const sentryProject = process.env.SENTRY_PROJECT_ADMIN_PORTAL ?? process.env.SENTRY_PROJECT;
const sentryRelease =
  process.env.VITE_ASPIRE_RELEASE ??
  process.env.ASPIRE_RELEASE ??
  process.env.RAILWAY_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  `aspire-admin@${pkg.version}`;
const sentryBuildEnabled =
  Boolean(process.env.SENTRY_AUTH_TOKEN) &&
  Boolean(process.env.SENTRY_ORG) &&
  Boolean(sentryProject);

async function loadSentryPlugin() {
  if (!sentryBuildEnabled) {
    return null;
  }

  try {
    const { sentryVitePlugin } = await import("@sentry/vite-plugin");
    return sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: sentryProject,
      url: process.env.SENTRY_URL ?? process.env.SENTRY_BASE_URL,
      telemetry: false,
      release: {
        name: sentryRelease,
      },
      sourcemaps: {
        assets: "./dist/**/*.{js,css,map}",
      },
    });
  } catch (error) {
    console.warn("[vite] @sentry/vite-plugin unavailable; skipping Sentry plugin upload.", error);
    return null;
  }
}

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const sentryPlugin = await loadSentryPlugin();

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        '/api': {
          target: process.env.VITE_OPS_FACADE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/api/, ''),
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __SENTRY_RELEASE__: JSON.stringify(sentryRelease),
    },
    plugins: [react(), mode === "development" && componentTagger(), sentryPlugin].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      sourcemap: mode === "production",
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', '@radix-ui/react-tooltip', '@radix-ui/react-popover', '@radix-ui/react-select'],
            'vendor-charts': ['recharts'],
          },
        },
      },
    },
  };
});
