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
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false };
    }
    return config;
  },
};