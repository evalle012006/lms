module.exports = {
    reactStrictMode: false,
    serverRuntimeConfig: {
        secret: 'A39518F3263ABF7687DC89697A21A'
    },
    publicRuntimeConfig: {
        apiUrl: process.env.DEV_URL
    },
    images: {
        domains: [process.env.NEXT_PUBLIC_IMAGE_HOST],
        remotePatterns: [
            {
                protocol: 'http',
                hostname: process.env.NEXT_PUBLIC_IMAGE_HOST,
                port: '',
                pathname: '/images/**',
            },
        ],
    }
}
