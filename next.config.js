module.exports = {
  reactStrictMode: false,
  serverRuntimeConfig: {
      secret: 'F59BF9E27B6D826CB71994A6D338A'
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