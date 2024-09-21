module.exports = {
    reactStrictMode: false,
    serverRuntimeConfig: {
        secret: 'A39518F3263ABF7687DC89697A21A'
    },
    publicRuntimeConfig: {
        apiUrl: process.env.DEV_URL
    },
    images: {
        domains: ['ambercashph.sgp1.digitaloceanspaces.com'],
    }
}
