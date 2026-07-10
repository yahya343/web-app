import type { NextConfig } from 'next';

/**
 * Static Export Configuration for Capacitor/Android Mobile App
 * ──────────────────────────────────────────────────────────
 *
 * OUTPUT MODE: `export`
 *   - Generates a fully static `out/` directory with HTML/CSS/JS
 *   - No Node.js server required — runs entirely in the mobile WebView
 *   - All data fetching is done client-side against the remote Admin Panel API
 *
 * IMAGES: `unoptimized`
 *   - Disables Next.js image optimization (requires a server)
 *   - Images are served directly from their source URLs
 *
 * TRAILING SLASH: enabled
 *   - Ensures file:// protocol compatibility in Capacitor
 *   - All routes resolve to `/path/index.html` internally
 *
 * SECURITY HEADERS (commented for export)
 *   - The `headers()` function is server-only and ignored in static export
 *   - Copy the header values below into your Capacitor or reverse-proxy config
 *     when deploying the storefront to production (VPS / Play Store)
 */

const nextConfig: NextConfig = {
  /** Suppress the Next.js dev activity indicator */
  devIndicators: false,

  /** ── Static Export Mode ────────────────────────────────────────── */
  output: 'export',

  /** ── Images: bypass the server-side optimizer ──────────────────── */
  images: {
    unoptimized: true,
  },

  /** ── Trailing slashes for file:// and Capacitor compatibility ──── */
  trailingSlash: true,

  /**
   * ── Security Headers (Server-Only — Reference for Production) ─────
   *
   * These headers are applied by the Next.js server in `next start` mode.
   * In the static export (`output: 'export'`), they are automatically
   * ignored by Next.js because there is no running server.
   *
   * When migrating the storefront to a production VPS or reverse-proxy
   * (nginx, Caddy, Cloudflare), copy the following header rules into
   * your proxy configuration to keep your app secure:
   *
   *   X-Frame-Options:           DENY
   *   X-Content-Type-Options:    nosniff
   *   X-XSS-Protection:          1; mode=block
   *   Strict-Transport-Security: max-age=31536000; includeSubDomains
   *   Referrer-Policy:           strict-origin-when-cross-origin
   *   Permissions-Policy:        camera=(), microphone=(), geolocation=(self), interest-cohort=()
   *   Content-Security-Policy:   default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...
   */
};

export default nextConfig;
