/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: This repo lives on an exFAT volume, which cannot store symlinks/junctions.
  // - Turbopack requires junction points for its build harness, so it PANICS here.
  //   Always build with `next build --webpack` (the package.json scripts do this).
  // - webpack's resolver hits phantom EISDIR errors unless symlink resolution is off.
  // If the repo moves to an NTFS drive, Turbopack (Next 16 default) can be used again.

  // react-joyride 2.9.3's ESM build (dist/index.mjs) imports
  // `unmountComponentAtNode` from react-dom, which webpack's ESM interop
  // fails to resolve against React 18's CJS build. Force the CJS entry.
  webpack: (config) => {
    // webpack filesystem cache cannot snapshot on exFAT.
    config.cache = false;

    // Skip resolver readlink calls that fail with EISDIR on exFAT.
    config.resolve.symlinks = false;

    const path = require('path');
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-joyride': path.join(process.cwd(), 'node_modules/react-joyride/dist/index.js'),
    };

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
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' ws: wss:",
            ].join('; '),
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
