/** @type {import('next').NextConfig} */
const nextConfig = {
  // SESSION-2026-09-17-039: pin the workspace root explicitly. Stray
  // package.json/package-lock.json in the user's HOME directory made Next's
  // lockfile inference pick the home dir as workspace root ("Next.js ignored
  // package-lock.json in C:\Users\spenc because it would include your home
  // directory" on every dev/build start). Verified against next@16.3.5
  // server/config.js: an explicit root here skips BOTH inference warnings
  // (home-dir boundary + duplicated-lockfiles) in BOTH bundler modes — the key
  // doubles as turbopack.root; never set the two to different values.
  outputFileTracingRoot: __dirname,

  // NOTE: This repo lives on an exFAT volume, which cannot store symlinks/junctions.
  // - Turbopack requires junction points for its build harness, so it PANICS here.
  //   Always build with `next build --webpack` (the package.json scripts do this).
  // - webpack's resolver hits phantom EISDIR errors unless symlink resolution is off.
  // If the repo moves to an NTFS drive, Turbopack (Next 16 default) can be used again.

  // FID-20260906-012 P0: the react-joyride 2.9.3 alias hack was REMOVED —
  // joyride 3.2.0 ships proper dual CJS/ESM exports (dist/index.cjs|index.mjs),
  // so webpack resolves it natively and the workaround is obsolete.
  webpack: (config) => {
    // webpack filesystem cache cannot snapshot on exFAT.
    config.cache = false;

    // Skip resolver readlink calls that fail with EISDIR on exFAT.
    config.resolve.symlinks = false;

    return config;
  },

  // FID-20260909-024: cheap response/body wins.
  compress: true,            // gzip responses (default true, pinned explicitly)
  poweredByHeader: false,    // drop X-Powered-By (fingerprinting, useless bytes)
  productionBrowserSourceMaps: false, // smaller browser payloads

  // Content Security Policy headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
              "worker-src 'self' blob:", // Allow Web Workers for canvas-confetti
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' ws: wss:",
            ].join('; '),
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
