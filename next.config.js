/** @type {import('next').NextConfig} */
const nextConfig = {
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
