module.exports = {
    reactStrictMode: false,
    serverRuntimeConfig: {
        secret: 'F59BF9E27B6D826CB71994A6D338A'
    },
    publicRuntimeConfig: {
        // apiUrl: process.env.NODE_ENV === 'development'
        //     ? 'http://localhost:3000/api' // development api
        //     : 'http://hybridag.castledigital.com.au:3000/api' // production api
        apiUrl: process.env.DEV_URL
    },
    images: {
        domains: ['images.local']
    }
}