module.exports = {
    async headers() {
        return [
          {
            // matching all API routes
            source: "/api/:path*",
            headers: [
              { key: "Access-Control-Allow-Credentials", value: "true" },
              { key: "Access-Control-Allow-Origin", value: "*" },
              { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
              { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
            ]
          }
        ]
      },
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
        domains: process.env.DEV_URL === 'http://localhost:3000' ? ['localhost'] : ['']
    }
}