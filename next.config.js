/** @type {import('next').NextConfig} */
module.exports = {
    experimental: {
        instrumentationHook: true,
    },
    reactStrictMode: false,
    serverRuntimeConfig: {
        secret: 'A39518F3263ABF7687DC89697A21A'
    },
    publicRuntimeConfig: {
        apiUrl: process.env.NEXT_PUBLIC_API_URL
    },
    images: {
        domains: ['ambercashph.sgp1.digitaloceanspaces.com'],
    },
    // FIX: face-api.js uses Node.js 'fs' module internally for file system access.
    // This is only needed server-side — tell webpack to provide empty stubs
    // for Node built-ins when bundling for the browser so the warning disappears.
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs:   false,
                path: false,
                os:   false,
            };
        }
        return config;
    },
}