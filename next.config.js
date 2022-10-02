module.exports = {
    reactStrictMode: false,
    serverRuntimeConfig: {
        secret: '82qtpkXuuzdsGWaZoAbYxNXL'
    },
    publicRuntimeConfig: {
        apiUrl: process.env.DEV_URL
    },
    images: {
        domains: [process.env.NEXT_PUBLIC_IMAGE_HOST],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: process.env.NEXT_PUBLIC_IMAGE_HOST,
                port: '',
                pathname: '/images/**',
            },
        ],
    }
}
