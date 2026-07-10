import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.omagh.phonevape',
  appName: 'Omagh Phone & Vape',
  webDir: 'out',

  /**
   * Server configuration for the Android WebView.
   *
   * allowNavigation: Whitelist domains the WebView can navigate to.
   *   Add your production VPS domain here when deployed.
   *   During development, localhost is already allowed.
   *
   * hostname: The hostname the WebView uses internally.
   *   'localhost' is the default and works with most CSP policies.
   */
  server: {
    allowNavigation: [
      'localhost:3000',
      'localhost:3001',
      // 'your-vps.com',       // ← Uncomment when deploying
      // '*.your-vps.com',     // ← Wildcard for subdomains
    ],
  },

  /**
   * Android-specific configuration.
   *
   * webContentsDebuggingEnabled: Enable Chrome DevTools debugging
   *   on the Android WebView. Set to false for production builds.
   *
   * allowMixedContent: Allow HTTP content when loading over HTTPS.
   *   Set to true if your VPS serves content over HTTPS but has
   *   mixed HTTP resources (not recommended for production).
   */
  /**
   * Android-specific configuration.
   *
   * webContentsDebuggingEnabled: Enable Chrome DevTools debugging
   *   on the Android WebView. Set to `false` before building the
   *   production release APK/AAB.
   *   Note: This is evaluated at `npx cap sync` time (on your dev
   *   machine), not at Next.js build time, so env vars must be
   *   available in your terminal session.
   */
  android: {
    webContentsDebuggingEnabled: true, // ← Set to false for production release
  },
};

export default config;
