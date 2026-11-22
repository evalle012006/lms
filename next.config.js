/** @type {import('next').NextConfig} */
const required = ['STAFF_JWT_SECRET', 'CLIENT_JWT_SECRET'];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Missing env var: ${k}`);
}

module.exports = {
  reactStrictMode: false,
  serverRuntimeConfig: {
    secret: process.env.STAFF_JWT_SECRET,
    clientSecret: process.env.CLIENT_JWT_SECRET,
  },
  publicRuntimeConfig: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ambercashph.sgp1.digitaloceanspaces.com' },
    ],
  },
  // Duplicate Clients moved from Settings to Reports (2026-11-22); keep old bookmarks and links working.
  async redirects() {
    return [
      { source: '/settings/duplicate-clients', destination: '/reports/duplicate-clients', permanent: false },
      { source: '/settings/duplicate-clients/stats', destination: '/reports/duplicate-clients/stats', permanent: false },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false };
    }
    return config;
  },
};